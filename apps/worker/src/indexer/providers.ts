/**
 * RPC provider setup — viem-based chain access for the Worker.
 *
 * Configures public + wallet clients for Monad testnet with fallback.
 *
 * E owns; B reviews chain config.
 */

import { MONAD_TESTNET, type NetworkConfig } from '@rentbond/shared';

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
  // TODO RB-12:
  // const { chainId } = await publicClient.getChainId();
  // return chainId === expectedChainId;
  console.warn(`[WORKER] verifyChainId not implemented — RB-12 required`);
  return true;
}
