/**
 * Network configuration and finality adapters.
 * E maintains; B reviews chain type mapping; D reviews RPC/storage config.
 *
 * Network identity is chainId + validated RPC. Both must agree before writes.
 * Never fall back to mainnet on mismatch.
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcFallbackUrl?: string;
  /** Estimated finality in blocks (Monad ~2s block time, 1 block for testnet) */
  finalityBlocks: number;
  /** Native currency symbol */
  nativeCurrency: string;
  /** Block explorer base URL */
  explorerUrl: string;
}

/** Monad testnet — chainId confirmed via RB-03 */
export const MONAD_TESTNET: NetworkConfig = {
  chainId: 10143,
  name: 'Monad Testnet',
  rpcUrl: process.env.RPC_URL ?? '',
  rpcFallbackUrl: process.env.RPC_FALLBACK_URL,
  finalityBlocks: 1,
  nativeCurrency: 'MON',
  explorerUrl: 'https://testnet.monadexplorer.com',
};

/**
 * Check that two network configs agree on chainId.
 * Returns true if consistent, false if mismatch.
 */
export function networksMatch(a: NetworkConfig, b: NetworkConfig): boolean {
  return a.chainId === b.chainId;
}

/**
 * Determine if a block number is considered finalised.
 * On Monad testnet finality is 1 block (conservative).
 */
export function isFinalized(
  currentBlock: number,
  eventBlock: number,
  finalityBlocks: number
): boolean {
  return currentBlock - eventBlock >= finalityBlocks;
}
