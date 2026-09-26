/**
 * Worker main process entry point.
 *
 * Independent long-running Node.js process. Cannot rely on web request lifecycle.
 *
 * Usage:
 *   node apps/worker/src/main.ts
 *
 * Environment (from .env):
 *   RPC_URL, RPC_FALLBACK_URL, CHAIN_ID,
 *   FACTORY_ADDRESS, RESOLVER_REGISTRY_ADDRESS,
 *   DEPLOYMENT_BLOCK, PERSISTENCE_PATH,
 *   WORKER_BATCH_SIZE, WORKER_POLL_INTERVAL_MS, WORKER_GAS_ACCOUNT
 *
 * E owns; B/D collaborate on event schema and projection mapping.
 */

import { loadWorkerConfig } from './config.js';

async function main() {
  // Validate all env vars before doing anything else
  const config = loadWorkerConfig();

  console.log('[worker] Starting RentBond Worker');
  console.log(`[worker] chain=${config.chainId}`);
  console.log(`[worker] factory=${config.factoryAddress}`);
  console.log(`[worker] registry=${config.resolverRegistryAddress}`);
  console.log(`[worker] deploymentBlock=${config.deploymentBlock}`);
  console.log(`[worker] batchSize=${config.batchSize} pollInterval=${config.pollIntervalMs}ms`);
  console.log(`[worker] persistence=${config.persistencePath}`);
  if (config.workerGasAccount) {
    console.log(`[worker] workerGasAccount=${config.workerGasAccount}`);
  }

  // TODO RB-12: initialize RPC provider, load ABI, start indexer loop
  // TODO RB-12: connect to persistence (DB or file-based queue)
  // TODO RB-12: start job scheduler
  // TODO RB-12: graceful shutdown on SIGTERM/SIGINT

  // Placeholder — prevents process from exiting immediately
  await new Promise<void>((resolve) => {
    const shutdown = () => {
      console.log('[worker] Shutting down...');
      resolve();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Indefinite hold until signal — prevents accidental early exit
    setTimeout(() => {
      console.warn('[worker] Timeout — worker loop not implemented (RB-12 required)');
      resolve();
    }, 10_000);
  });
}

main().catch((err) => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});
