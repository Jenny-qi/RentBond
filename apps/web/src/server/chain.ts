import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import artifacts from "./contracts.generated.json" with { type: "json" };
import type { Config } from "./config.ts";
import type { Row } from "./db.ts";
import { ApiFailure, requireThat, unavailable } from "./errors.ts";

export interface ChainSnapshot {
  terms: Row;
  accounting: Row;
  schedule: Row;
  activeCase: Row;
  phase: number;
  claims: Row[];
  decisions: Row[];
  chainTime: number;
  blockNumber: string;
  blockHash: string;
}
export interface ProfileSnapshot {
  profile: Row;
  status: Row;
  chainTime: number;
}
export interface Chain {
  health(): Promise<boolean>;
  lease(
    address: string,
    confirmed?: boolean,
    atBlock?: string,
  ): Promise<ChainSnapshot>;
  profile(profileId: string): Promise<ProfileSnapshot>;
  transaction(hash: string): Promise<Row>;
  prepareGas(
    wallet: string,
    amount: bigint,
  ): Promise<{ raw: string; hash: string }>;
  broadcast(raw: string): Promise<void>;
  receipt(hash: string): Promise<Row | null>;
  events(address: string, fromBlock: string, toBlock: string): Promise<Row[]>;
  creation(hash: string): Promise<Row[]>;
  blockHash(block: string): Promise<string>;
  evidence(
    address: string,
    author: string,
    bundleId: string,
    version: number,
  ): Promise<Row>;
}
const json = <T>(value: unknown): T =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
export const escrowAbi = artifacts.DepositEscrow as Abi;
export const registryAbi = artifacts.ResolverRegistry as Abi;
export const factoryAbi = artifacts.LeaseFactory as Abi;

export function createChain(config: Config): Chain {
  const chain = defineChain({
    id: config.chainId,
    name: "RentBond " + config.mode,
    nativeCurrency: { name: "Test MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl ?? "http://127.0.0.1:8545"] } },
    testnet: true,
  });
  const endpoints = [config.rpcUrl, config.rpcFallbackUrl].filter(
    (v): v is string => !!v,
  );
  const clients = endpoints.map((url) =>
    createPublicClient({
      chain,
      cacheTime: 0,
      transport: http(url, { timeout: 8000, retryCount: 0 }),
    }),
  );
  const connected = async () => {
    if (!clients.length) throw unavailable("RPC is not configured.");
    const results = await Promise.allSettled(
      clients.map((c) => c.getChainId()),
    );
    if (
      results.some(
        (r) => r.status === "fulfilled" && r.value !== config.chainId,
      )
    ) {
      throw new ApiFailure(
        503,
        "RPC_CHAIN_MISMATCH",
        "RPC networks disagree.",
        true,
      );
    }
    const i = results.findIndex((r) => r.status === "fulfilled");
    if (i < 0) throw unavailable("RPC is unavailable.");
    return { client: clients[i], url: endpoints[i] };
  };
  const finalizedReceipt = async (hash: string) => {
    const { client } = await connected();
    try {
      const receipt = await client.getTransactionReceipt({ hash: hash as Hex });
      const head = await client.getBlockNumber();
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (block.hash !== receipt.blockHash)
        throw unavailable("Transaction block changed.");
      return {
        receipt,
        confirmed:
          head - receipt.blockNumber + 1n >= BigInt(config.confirmations),
      };
    } catch (error) {
      if ((error as Error).name === "TransactionReceiptNotFoundError")
        return null;
      throw error;
    }
  };
  return {
    async health() {
      await connected();
      return true;
    },
    async lease(address, confirmed = false, atBlock) {
      const { client } = await connected();
      const head = await client.getBlockNumber();
      const confirmedHead = confirmed
        ? head - BigInt(config.confirmations - 1)
        : head;
      const blockNumber =
        atBlock === undefined ? confirmedHead : BigInt(atBlock);
      requireThat(
        blockNumber <= confirmedHead,
        409,
        "BLOCK_NOT_CONFIRMED",
        "Requested block has not reached the confirmation threshold.",
      );
      if (blockNumber < 0n)
        throw unavailable("Waiting for configured confirmations.");
      const block = await client.getBlock({ blockNumber });
      const read = (functionName: string, args?: unknown[]) =>
        client.readContract({
          address: address as Address,
          abi: escrowAbi,
          functionName,
          args,
          blockNumber,
        });
      const values = await Promise.all(
        [
          "getTerms",
          "getAccounting",
          "getSettlementSchedule",
          "getActiveCase",
          "getLeasePhase",
          "getClaimCount",
          "getDecisionCount",
          "factory",
        ].map((n) => read(n)),
      );
      requireThat(
        config.factoryAddress &&
          String(values[7]).toLowerCase() ===
            config.factoryAddress.toLowerCase(),
        403,
        "UNKNOWN_CONTRACT",
        "Lease is not from the configured factory.",
      );
      const claimCount = Number(values[5]),
        decisionCount = Number(values[6]);
      requireThat(
        claimCount <= 10 && decisionCount <= 10,
        503,
        "INVALID_CHAIN_STATE",
        "Invalid contract response.",
      );
      const claims = await Promise.all(
        Array.from({ length: claimCount }, (_, i) =>
          read("getClaim", [BigInt(i + 1)]),
        ),
      );
      const decisions = await Promise.all(
        Array.from({ length: decisionCount }, (_, i) =>
          read("getDecision", [BigInt(i)]),
        ),
      );
      const end = await client.getBlock({ blockNumber });
      if (end.hash !== block.hash)
        throw unavailable("Block changed during the read. Retry.");
      return json<ChainSnapshot>({
        terms: values[0],
        accounting: values[1],
        schedule: values[2],
        activeCase: values[3],
        phase: Number(values[4]),
        claims,
        decisions,
        chainTime: Number(block.timestamp),
        blockNumber,
        blockHash: block.hash,
      });
    },
    async profile(profileId) {
      requireThat(
        config.registryAddress,
        503,
        "SERVICE_UNAVAILABLE",
        "Registry is not configured.",
      );
      const { client } = await connected();
      const block = await client.getBlock();
      const [profile, status] = (await client.readContract({
        address: config.registryAddress as Address,
        abi: registryAbi,
        functionName: "getProfile",
        args: [profileId],
        blockNumber: block.number,
      })) as [Row, Row];
      return json<ProfileSnapshot>({
        profile,
        status,
        chainTime: Number(block.timestamp),
      });
    },
    async transaction(hash) {
      const { client } = await connected();
      try {
        const transaction = await client.getTransaction({ hash: hash as Hex });
        const result = await finalizedReceipt(hash);
        return json({
          hash,
          chainId: config.chainId,
          to: transaction.to?.toLowerCase(),
          from: transaction.from.toLowerCase(),
          status: !result
            ? "pending"
            : !result.confirmed
              ? "confirming"
              : result.receipt.status === "success"
                ? "confirmed"
                : "failed",
          blockNumber: result?.receipt.blockNumber ?? null,
          confirmationsRequired: config.confirmations,
        });
      } catch (error) {
        if ((error as Error).name === "TransactionNotFoundError")
          throw new ApiFailure(
            404,
            "TX_NOT_FOUND",
            "Transaction was not found.",
          );
        throw error;
      }
    },
    async prepareGas(wallet, amount) {
      requireThat(
        config.mode === "testnet" &&
          config.chainId === 10143 &&
          config.sponsorKey,
        503,
        "GAS_DISABLED",
        "Test gas sponsor is unavailable.",
      );
      const { client, url } = await connected();
      const account = privateKeyToAccount(config.sponsorKey as Hex);
      requireThat(
        account.address.toLowerCase() !== wallet.toLowerCase(),
        403,
        "FORBIDDEN",
        "Sponsor cannot refill itself.",
      );
      const signer = createWalletClient({
        account,
        chain,
        transport: http(url, { retryCount: 0, timeout: 8000 }),
      });
      const prepared = await signer.prepareTransactionRequest({
        to: wallet as Address,
        value: amount,
        data: "0x",
      });
      const feeFields = prepared as {
        maxFeePerGas?: bigint;
        gasPrice?: bigint;
      };
      const fee = feeFields.maxFeePerGas ?? feeFields.gasPrice ?? 0n;
      const balance = await client.getBalance({ address: account.address });
      requireThat(
        balance >= amount + prepared.gas * fee,
        503,
        "GAS_INSUFFICIENT_BALANCE",
        "Test gas sponsor has insufficient balance.",
      );
      const raw = await signer.signTransaction(prepared);
      return { raw, hash: keccak256(raw) };
    },
    async broadcast(raw) {
      const { client } = await connected();
      const returned = await client.sendRawTransaction({
        serializedTransaction: raw as Hex,
      });
      requireThat(
        returned === keccak256(raw as Hex),
        503,
        "RPC_ERROR",
        "Unexpected transaction hash.",
      );
    },
    async receipt(hash) {
      const result = await finalizedReceipt(hash);
      return result?.confirmed ? json(result.receipt) : null;
    },
    async events(address, fromBlock, toBlock) {
      const { client } = await connected();
      const logs = await client.getContractEvents({
        address: address as Address,
        abi: escrowAbi,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        strict: true,
      });
      return json<Row[]>(logs);
    },
    async creation(hash) {
      const result = await finalizedReceipt(hash);
      requireThat(
        result?.confirmed && result.receipt.status === "success",
        409,
        "TX_NOT_CONFIRMED",
        "Factory transaction is not confirmed.",
      );
      const { parseEventLogs } = await import("viem");
      return json<Row[]>(
        parseEventLogs({
          abi: factoryAbi,
          eventName: "LeaseCreated",
          logs: result.receipt.logs,
        }).filter(
          (log) =>
            log.address.toLowerCase() === config.factoryAddress?.toLowerCase(),
        ),
      );
    },
    async blockHash(block) {
      const { client } = await connected();
      const result = await client.getBlock({ blockNumber: BigInt(block) });
      requireThat(result.hash, 503, "RPC_ERROR", "Block hash is unavailable.");
      return result.hash;
    },
    async evidence(address, author, bundleId, version) {
      const { client } = await connected();
      const head = await client.getBlockNumber();
      const number = head - BigInt(config.confirmations - 1);
      requireThat(
        number >= 0n,
        409,
        "BLOCK_NOT_CONFIRMED",
        "Waiting for evidence confirmations.",
      );
      const block = await client.getBlock({ blockNumber: number });
      const record = await client.readContract({
        address: address as Address,
        abi: escrowAbi,
        functionName: "getEvidence",
        args: [author, bundleId, BigInt(version)],
        blockNumber: block.number,
      });
      return json<Row>({
        ...(record as Row),
        blockNumber: block.number,
        blockHash: block.hash,
      });
    },
  };
}
