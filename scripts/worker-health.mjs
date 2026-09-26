#!/usr/bin/env node
/**
 * Worker health check — verifies config loading without starting the full loop.
 *
 * Usage:
 *   node scripts/worker-health.mjs
 *
 * Exits 0 if config is valid and all required env vars are present.
 * Exits 1 if config is invalid with a descriptive error.
 *
 * E owns.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// We can't import the Worker's config.ts directly (it references @rentbond/shared)
// so we inline the validation here for the health check.
const required = [
  'RPC_URL',
  'CHAIN_ID',
  'FACTORY_ADDRESS',
  'RESOLVER_REGISTRY_ADDRESS',
  'DEPLOYMENT_BLOCK',
  'PERSISTENCE_PATH',
];

const optional = [
  'RPC_FALLBACK_URL',
  'WORKER_BATCH_SIZE',
  'WORKER_POLL_INTERVAL_MS',
  'WORKER_GAS_ACCOUNT',
];

const errors = [];

for (const key of required) {
  if (!process.env[key]) {
    errors.push(`Missing required env: ${key}`);
  }
}

const chainId = process.env['CHAIN_ID'];
if (chainId !== undefined) {
  const n = Number(chainId);
  if (!Number.isFinite(n) || n <= 0) {
    errors.push(`CHAIN_ID must be a positive integer, got: ${chainId}`);
  }
}

const batchSize = process.env['WORKER_BATCH_SIZE'];
if (batchSize !== undefined) {
  const n = Number(batchSize);
  if (!Number.isFinite(n) || n <= 0 || n > 10_000) {
    errors.push(`WORKER_BATCH_SIZE must be 1–10000, got: ${batchSize}`);
  }
}

const pollInterval = process.env['WORKER_POLL_INTERVAL_MS'];
if (pollInterval !== undefined) {
  const n = Number(pollInterval);
  if (!Number.isFinite(n) || n < 1_000 || n > 300_000) {
    errors.push(`WORKER_POLL_INTERVAL_MS must be 1000–300000, got: ${pollInterval}`);
  }
}

const deploymentBlock = process.env['DEPLOYMENT_BLOCK'];
if (deploymentBlock !== undefined) {
  try {
    BigInt(deploymentBlock);
  } catch {
    errors.push(`DEPLOYMENT_BLOCK must be an integer, got: ${deploymentBlock}`);
  }
}

function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

for (const key of ['FACTORY_ADDRESS', 'RESOLVER_REGISTRY_ADDRESS', 'WORKER_GAS_ACCOUNT']) {
  const val = process.env[key];
  if (val && !isValidAddress(val)) {
    errors.push(`${key} must be a valid EVM address, got: ${val}`);
  }
}

console.log('=== Worker Health Check ===');
console.log(`RPC_URL: ${process.env['RPC_URL'] ?? '(missing)'}`);
console.log(`CHAIN_ID: ${chainId ?? '(missing)'}`);
console.log(`FACTORY_ADDRESS: ${process.env['FACTORY_ADDRESS'] ?? '(missing)'}`);
console.log(`RESOLVER_REGISTRY_ADDRESS: ${process.env['RESOLVER_REGISTRY_ADDRESS'] ?? '(missing)'}`);
console.log(`DEPLOYMENT_BLOCK: ${deploymentBlock ?? '(missing)'}`);
console.log(`PERSISTENCE_PATH: ${process.env['PERSISTENCE_PATH'] ?? '(missing)'}`);
console.log(`WORKER_GAS_ACCOUNT: ${process.env['WORKER_GAS_ACCOUNT'] ?? '(optional)'}`);
console.log(`WORKER_BATCH_SIZE: ${batchSize ?? '(default 100)'}`);
console.log(`WORKER_POLL_INTERVAL_MS: ${pollInterval ?? '(default 5000)'}`);

if (errors.length > 0) {
  console.error('\nERRORS:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\nOK: Worker configuration is valid.');
  process.exit(0);
}
