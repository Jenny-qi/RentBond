/**
 * Worker configuration — validates all required environment variables.
 *
 * Throws at startup (not at runtime) if config is invalid.
 * This prevents the Worker from running in a misconfigured state.
 *
 * E owns.
 */

import type { Address } from '@rentbond/shared';
import { normalizeAddress } from '@rentbond/shared';

export interface ValidatedWorkerConfig {
  rpcUrl: string;
  rpcFallbackUrl?: string;
  chainId: number;
  factoryAddress: Address;
  resolverRegistryAddress: Address;
  deploymentBlock: bigint;
  persistencePath: string;
  batchSize: number;
  pollIntervalMs: number;
  workerGasAccount?: Address;
}

function requiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

function parseIntEnv(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error(`${key} must be a number, got: ${val}`);
  return n;
}

function parseAddress(key: string): Address {
  try {
    return normalizeAddress(requiredEnv(key));
  } catch {
    throw new Error(`${key} must be a valid EVM address`);
  }
}

/** Validate and return the Worker configuration from environment variables. */
export function loadWorkerConfig(): ValidatedWorkerConfig {
  const chainId = Number(requiredEnv('CHAIN_ID'));
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error(`CHAIN_ID must be a positive integer, got: ${chainId}`);
  }

  const factoryAddress = parseAddress('FACTORY_ADDRESS');
  const resolverRegistryAddress = parseAddress('RESOLVER_REGISTRY_ADDRESS');

  const deploymentBlock = BigInt(requiredEnv('DEPLOYMENT_BLOCK'));
  if (deploymentBlock < 0n) {
    throw new Error(`DEPLOYMENT_BLOCK must be non-negative, got: ${deploymentBlock}`);
  }

  const batchSize = parseIntEnv('WORKER_BATCH_SIZE', 100);
  if (batchSize <= 0 || batchSize > 10_000) {
    throw new Error(`WORKER_BATCH_SIZE must be 1–10000, got: ${batchSize}`);
  }

  const pollIntervalMs = parseIntEnv('WORKER_POLL_INTERVAL_MS', 5_000);
  if (pollIntervalMs < 1_000 || pollIntervalMs > 300_000) {
    throw new Error(`WORKER_POLL_INTERVAL_MS must be 1000–300000, got: ${pollIntervalMs}`);
  }

  const workerGasAccount = optionalEnv('WORKER_GAS_ACCOUNT');
  if (workerGasAccount) {
    try {
      normalizeAddress(workerGasAccount);
    } catch {
      throw new Error(`WORKER_GAS_ACCOUNT must be a valid EVM address`);
    }
  }

  return {
    rpcUrl: requiredEnv('RPC_URL'),
    rpcFallbackUrl: optionalEnv('RPC_FALLBACK_URL'),
    chainId,
    factoryAddress,
    resolverRegistryAddress,
    deploymentBlock,
    persistencePath: requiredEnv('PERSISTENCE_PATH'),
    batchSize,
    pollIntervalMs,
    workerGasAccount: workerGasAccount as Address | undefined,
  };
}
