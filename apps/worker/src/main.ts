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
import { startIndexer } from './indexer/loop.js';

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

  // RB-12: start the indexer loop — runs until SIGTERM/SIGINT
  await startIndexer(config);
}

main().catch((err) => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});
