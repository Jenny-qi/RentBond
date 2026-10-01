/**
 * RPC provider setup — viem-based chain access for the Worker.
 *
 * Configures public + wallet clients for Monad testnet with fallback.
 *
 * E owns; B reviews chain config.
 */

import type { NetworkConfig } from '@rentbond/shared';

// TODO RB-12: replace with real viem import
// import { createPublicClient, createWalletClient, http, fallback } from 'viem';
// import { monadTestnet } from 'viem/chains';

export interface RpcConfig {
  primaryUrl: string;
  fallbackUrl?: string;
  network: NetworkConfig;
}

/** Build a viem public client for the configured network */
export async function buildPublicClient(config: RpcConfig) {
  // TODO RB-12:
  // const transport = config.fallbackUrl
  //   ? fallback([http(config.primaryUrl), http(config.fallbackUrl)])
  //   : http(config.primaryUrl);
  // return createPublicClient({
  //   transport,
  //   chain: monadTestnet,
  //   pollingInterval: config.network.pollIntervalMs ?? 4_000,
  // });
  console.warn('[WORKER] buildPublicClient not implemented — RB-12 required');
  throw new Error('RPC provider not implemented — RB-12 required');
}

/** Build a viem wallet client for the Worker gas account */
export async function buildWalletClient(
  config: RpcConfig,
  workerGasAccount: `0x${string}`
) {
  // TODO RB-12:
  // const publicClient = await buildPublicClient(config);
  // return createWalletClient({
  //   account: workerGasAccount,
  //   transport: http(config.primaryUrl),
  //   chain: monadTestnet,
  // });
  console.warn('[WORKER] buildWalletClient not implemented — RB-12 required');
  throw new Error('Wallet client not implemented — RB-12 required');
}

/** Verify the connected chain matches the expected chainId */
export async function verifyChainId(rpcUrl: string, expectedChainId: number): Promise<boolean> {
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) {
    throw new Error('Expected chain ID must be a positive safe integer');
  }
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`RPC chain ID request failed: HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || !('result' in payload)) {
    throw new Error('RPC chain ID response is missing a result');
  }
  const chainId = payload.result;
  if (typeof chainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(chainId)) {
    throw new Error('RPC chain ID response is invalid');
  }
  return BigInt(chainId) === BigInt(expectedChainId);
}
