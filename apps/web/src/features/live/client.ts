import { createPublicClient, createWalletClient, defineChain, http, custom, encodeFunctionData, erc20Abi, type Abi, type Address, type Hex, type Account, type EIP1193Provider } from 'viem';
import escrowJson from '../../../../../deployments/abi/DepositEscrow.json' with { type: 'json' };
import factoryJson from '../../../../../deployments/abi/LeaseFactory.json' with { type: 'json' };
import { verifyConservation } from '../../lib/money.ts';

// JSON at the API boundary; ABI decoding is checked before displaying funds.
export type Data = Record<string, any>;
export interface LiveConfig { mode: string; chainId: number; rpcUrl: string; factory: string; confirmations: number }
export interface Wallet { address: Address; account?: Account; provider?: EIP1193Provider; end: () => void }
export interface Action { title: string; explanation: string; address: Address; functionName: string; args: readonly unknown[]; kind?: 'escrow' | 'factory' | 'token'; leaseId?: string; after?: (hash: Hex) => Promise<void> }
export const escrowAbi = escrowJson as Abi;
export const factoryAbi = factoryJson as Abi;
export const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
export function checkedConfig(config: LiveConfig) {
  if (!Number.isSafeInteger(config.chainId) || config.chainId <= 0 || !Number.isSafeInteger(config.confirmations) || config.confirmations < 1 || !/^0x[\da-f]{40}$/i.test(config.factory)) throw new Error('Environment not configured: network, factory and confirmation policy are required.');
  const url = new URL(config.rpcUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('A credential-free public RPC URL is required.');
  if (config.mode !== 'local' && (config.mode !== 'testnet' || config.chainId !== 10143 || url.protocol !== 'https:')) throw new Error('Only the configured local chain or Monad testnet is supported.');
  return config;
}
export function clients(config: LiveConfig, wallet?: Wallet) {
  checkedConfig(config);
  const chain = defineChain({ id: config.chainId, name: config.mode === 'local' ? 'RentBond local chain' : 'Monad testnet', nativeCurrency: { name: 'Test MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] } }, testnet: true });
  const transport = http(config.rpcUrl, { timeout: 10000, retryCount: 0 });
  return { publicClient: createPublicClient({ chain, transport, cacheTime: 0 }), walletClient: wallet ? createWalletClient({ chain, transport: wallet.provider ? custom(wallet.provider) : transport, account: wallet.account ?? wallet.address }) : undefined };
}
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const retryKeys = new Map<string, string>();
export function clearRequests() { retryKeys.clear(); }
export async function api(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', key?: string): Promise<Data> {
  if (!path.startsWith('/api/') || path.includes('://')) throw new Error('Invalid API path');
  const fingerprint = `${method}:${path}:${JSON.stringify(body)}`;
  const commandKey = key ?? retryKeys.get(fingerprint) ?? crypto.randomUUID();
  if (method === 'POST') retryKeys.set(fingerprint, commandKey);
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json', ...(method === 'POST' ? { 'Idempotency-Key': commandKey } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json();
  if (response.ok || response.status < 500) retryKeys.delete(fingerprint);
  if (!response.ok) throw new ApiError(response.status, `${value.error?.code ?? response.status}: ${value.error?.message ?? 'Request failed'}`);
  return value;
}
export function actionAbi(action: Action): Abi { return action.kind === 'factory' ? factoryAbi : action.kind === 'token' ? erc20Abi : escrowAbi; }
export function actionData(action: Action) { return encodeFunctionData({ abi: actionAbi(action), functionName: action.functionName, args: action.args }); }
export async function checkWallet(config: LiveConfig, wallet: Wallet) {
  const { publicClient } = clients(config);
  if (await publicClient.getChainId() !== config.chainId) throw new Error('RPC network mismatch. Transactions are disabled.');
  if (wallet.provider) {
    const id = await wallet.provider.request({ method: 'eth_chainId' });
    const addresses = await wallet.provider.request({ method: 'eth_accounts' });
    if (Number(id) !== config.chainId || addresses[0]?.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Wallet account or network changed. Please sign in again.');
  }
}
export function assertAccounting(accounting: Data) {
  for (const k of ['fundedAmount', 'unallocated', 'tenantCredit', 'landlordCredit', 'tenantWithdrawn', 'landlordWithdrawn']) if (!/^\d+$/.test(String(accounting[k]))) throw new Error('Invalid on-chain amount format.');
  if (!verifyConservation(String(accounting.fundedAmount), accounting as Parameters<typeof verifyConservation>[1])) throw new Error('On-chain accounting does not conserve funds.');
}
export async function readLease(config: LiveConfig, address: Address, commitment: string) {
  const { publicClient: c } = clients(config);
  if (await c.getChainId() !== config.chainId) throw new Error('RPC network mismatch');
  const head = await c.getBlockNumber();
  const blockNumber = head - BigInt(config.confirmations - 1);
  if (blockNumber < 0n) throw new Error('Waiting for a confirmed block');
  const block = await c.getBlock({ blockNumber });
  const read = (functionName: string, args?: unknown[]) => c.readContract({ address, abi: escrowAbi, functionName, args, blockNumber });
  const [terms, accounting, schedule, activeCase, phase, count, factory, checkout, proposal] = await Promise.all(['getTerms', 'getAccounting', 'getSettlementSchedule', 'getActiveCase', 'getLeasePhase', 'getClaimCount', 'factory', 'getCheckout', 'getSettlementProposal'].map(n => read(n)));
  const t = terms as Data;
  if (String(factory).toLowerCase() !== config.factory.toLowerCase() || String(t.termsHash).toLowerCase() !== commitment.toLowerCase()) throw new Error('Contract factory or terms commitment mismatch.');
  if (Number(count) > 10) throw new Error('Invalid claim count');
  const claims = await Promise.all(Array.from({ length: Number(count) }, (_, i) => read('getClaim', [BigInt(i + 1)])));
  const allowance = await c.readContract({ address: t.token, abi: erc20Abi, functionName: 'allowance', args: [t.tenant, address], blockNumber });
  const end = await c.getBlock({ blockNumber });
  if (end.hash !== block.hash) throw new Error('The block changed. Refresh before continuing.');
  const result = JSON.parse(json({ terms, accounting, schedule, activeCase, phase, claims, checkout, proposal, allowance, chainTime: block.timestamp, blockNumber, blockHash: block.hash }));
  assertAccounting(result.accounting);
  return result as Data;
}
export function canConfirmProposal(proposal: Data, accounting: Data, chainTime: number, address: string, hardEndAt: number, timeoutAt = 0) {
  return BigInt(proposal.proposalId ?? 0) > 0n && proposal.proposer?.toLowerCase() !== address.toLowerCase() && String(proposal.snapshotRevision) === String(accounting.revision) && BigInt(proposal.tenantShare) + BigInt(proposal.landlordShare) === BigInt(accounting.unallocated) && chainTime < Number(proposal.validUntil) && chainTime < hardEndAt && (!timeoutAt || chainTime < timeoutAt);
}
