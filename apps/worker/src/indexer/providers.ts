/**
 * RPC provider setup — native fetch for reads, viem for writes.
 *
 * Configures public + wallet clients for Monad testnet with fallback.
 *
 * E owns; B reviews chain config.
 */

import { MONAD_TESTNET, type NetworkConfig } from '@rentbond/shared';

// TODO RB-12: replace with real viem import for wallet client
// import { createPublicClient, createWalletClient, http, fallback } from 'viem';
// import { monadTestnet } from 'viem/chains';

export interface RpcConfig {
  primaryUrl: string;
  fallbackUrl?: string;
  network: NetworkConfig;
}

// ---------------------------------------------------------------------------
// Internal RPC helper
// ---------------------------------------------------------------------------

/** Lightweight JSON-RPC call via native fetch (no viem needed for reads). */
async function rpcCall<T>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: HTTP ${res.status}`);
  const payload = (await res.json()) as { result?: T; error?: { message: string } };
  if (payload.error) throw new Error(`RPC ${method} error: ${payload.error.message}`);
  return payload.result as T;
}

// ---------------------------------------------------------------------------
// Public client (read-only)
// ---------------------------------------------------------------------------

export interface LogFilter {
  address?: string;
  topics?: (string | null[])[];
  fromBlock?: string | 'latest';
  toBlock?: string | 'latest';
  blockHash?: string;
}

export interface CallParams {
  to: string;
  data?: string;
  from?: string;
  value?: string;
}

export interface PublicClient {
  /** eth_getLogs */
  getLogs(filter: LogFilter): Promise<unknown[]>;
  /** eth_blockNumber */
  getBlockNumber(): Promise<bigint>;
  /** eth_chainId */
  getChainId(): Promise<number>;
  /** eth_call — read contract state */
  call(params: CallParams): Promise<string>;
}

/** Build a read-only public client backed by native fetch RPC. */
export async function buildPublicClient(config: RpcConfig): Promise<PublicClient> {
  const url = config.primaryUrl;

  return {
    getLogs: (filter: LogFilter) =>
      rpcCall<unknown[]>(url, 'eth_getLogs', [filter]),

    getBlockNumber: () =>
      rpcCall<string>(url, 'eth_blockNumber', []).then((hex) => BigInt(hex)),

    getChainId: () =>
      rpcCall<string>(url, 'eth_chainId', []).then((hex) => Number(BigInt(hex))),

    call: (params: CallParams) =>
      rpcCall<string>(url, 'eth_call', [params, 'latest']),
  };
}

// ---------------------------------------------------------------------------
// Chain verification
// ---------------------------------------------------------------------------

/** Verify the connected chain matches the expected chainId. Throws on mismatch. */
export async function verifyChainId(rpcUrl: string, expectedChainId: number): Promise<boolean> {
  const chainId = await rpcCall<string>(rpcUrl, 'eth_chainId', []).then((hex) => Number(BigInt(hex)));
  if (chainId !== expectedChainId) {
    throw new Error(
      `Chain ID mismatch: expected ${expectedChainId}, got ${chainId}`
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Wallet client stub — viem write transactions added in RB-12
// ---------------------------------------------------------------------------

/** Build a viem wallet client for the Worker gas account */
export async function buildWalletClient(
  _config: RpcConfig,
  _workerGasAccount: `0x${string}`
) {
  // TODO RB-12: implement with viem createWalletClient
  // const publicClient = await buildPublicClient(config);
  // return createWalletClient({
  //   account: workerGasAccount,
  //   transport: http(config.primaryUrl),
  //   chain: monadTestnet,
  // });
  console.warn('[WORKER] buildWalletClient not implemented — RB-12 required');
  throw new Error('Wallet client not implemented — RB-12 required');
}
