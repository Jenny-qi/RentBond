import { createPublicClient, createWalletClient, defineChain, http, fallback,
  decodeEventLog, encodeEventTopics, encodeFunctionData, keccak256,
  recoverTransactionAddress } from 'viem';
import { factoryAbi, escrowAbi } from '../../web/src/server/chain.ts';
import { workerActions, actionMatches } from '../../web/src/server/worker-actions.ts';

const json = (value) => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
const topics = new Set(factoryAbi.filter((a) => a.type === 'event').map((event) =>
  encodeEventTopics({ abi: [event], eventName: event.name })[0]));

export function createWorkerRpc(config, account) {
  const chain = defineChain({ id: config.chainId, name: 'RentBond test only', testnet: true,
    nativeCurrency: { name: 'Test MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } } });
  const urls = [...new Set([config.rpcUrl, config.rpcFallbackUrl].filter(Boolean))];
  const connect = async () => {
    const checks = await Promise.allSettled(urls.map((url) =>
      createPublicClient({ transport: http(url, { timeout: 8000, retryCount: 0 }) }).getChainId()));
    if (checks.some((r) => r.status === 'fulfilled' && r.value !== config.chainId)) throw new Error('RPC_CHAIN_MISMATCH');
    const good = urls.filter((_, i) => checks[i].status === 'fulfilled');
    if (!good.length) throw new Error('RPC_UNAVAILABLE');
    const transport = fallback(good.map((url) => http(url, { timeout: 8000, retryCount: 0 })), { retryCount: 0 });
    return { client: createPublicClient({ chain, cacheTime: 0, transport }), transport };
  };
  const preflight = async (job, snapshot, client) => {
    if (!account || !actionMatches(job, snapshot) || BigInt(snapshot.chainTime) < BigInt(job.due_at)) throw new Error('ACTION_NOT_ELIGIBLE');
    const roles = ['landlord', 'tenant', 'primaryResolver', 'fallbackResolver'];
    if (roles.some((r) => snapshot.terms[r].toLowerCase() === account.address.toLowerCase())) throw new Error('WORKER_ROLE_ACCOUNT');
    const action = workerActions[job.kind];
    const args = action.case ? [BigInt(job.case_id)] : [];
    const request = { address: job.contract_address, abi: escrowAbi, functionName: action.fn, args, account };
    await client.simulateContract(request);
    return encodeFunctionData(request);
  };
  return {
    account: account?.address.toLowerCase(),
    async head() {
      const { client } = await connect();
      const number = await client.getBlockNumber() - BigInt(config.confirmations - 1);
      if (number < 0n) throw new Error('BLOCK_NOT_CONFIRMED');
      const b = await client.getBlock({ blockNumber: number });
      if (!b.hash) throw new Error('INVALID_BLOCK');
      return b;
    },
    async block(number) {
      const { client } = await connect();
      return client.getBlock({ blockNumber: BigInt(number) });
    },
    async factoryEvents(fromBlock, toBlock) {
      const { client } = await connect();
      const logs = await client.getLogs({ address: config.factoryAddress,
        fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock) });
      return logs.filter((log) => topics.has(log.topics[0])).map((log) => {
        if (log.removed || log.blockNumber === null || log.logIndex === null || !log.transactionHash || !log.blockHash) throw new Error('INVALID_LOG');
        // Fail the batch on malformed known events; never advance past undecodable logs.
        const decoded = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics, strict: true });
        return json({ ...log, ...decoded });
      });
    },
    async prepare(job, snapshot) {
      const { client, transport } = await connect();
      const data = await preflight(job, snapshot, client);
      const wallet = createWalletClient({ account, chain, transport });
      const prepared = await wallet.prepareTransactionRequest({ to: job.contract_address, data, value: 0n });
      const maxFee = prepared.maxFeePerGas ?? prepared.gasPrice;
      if (!maxFee || prepared.gas * maxFee > config.maxFeeWei) throw new Error('WORKER_FEE_LIMIT');
      return wallet.signTransaction(prepared);
    },
    async broadcast(job, snapshot) {
      const { client } = await connect();
      if (keccak256(job.raw_transaction) !== job.tx_hash ||
        (await recoverTransactionAddress({ serializedTransaction: job.raw_transaction })).toLowerCase() !== account?.address.toLowerCase()) throw new Error('SIGNED_TRANSACTION_MISMATCH');
      await preflight(job, snapshot, client);
      const hash = await client.sendRawTransaction({ serializedTransaction: job.raw_transaction });
      if (hash !== job.tx_hash) throw new Error('TRANSACTION_HASH_MISMATCH');
    },
  };
}
