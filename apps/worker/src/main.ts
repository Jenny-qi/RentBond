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
import { startExecutor } from './jobs/executor.js';

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

  // Start indexer loop (always)
  const indexerPromise = startIndexer(config);

  // Start executor only if a gas account is configured
  let executorPromise: Promise<void> | undefined;
  if (config.workerGasAccount) {
    executorPromise = startExecutor({
      rpcUrl: config.rpcUrl,
      workerGasAccount: config.workerGasAccount,
      persistencePath: config.persistencePath,
      pollIntervalMs: config.pollIntervalMs,
      chainId: config.chainId,
    });
  } else {
    console.log('[worker] No WORKER_GAS_ACCOUNT — executor not started (read-only mode)');
  }

  // Wait for whichever exits first (SIGTERM/SIGINT triggers both)
  await Promise.race([indexerPromise, executorPromise].filter(Boolean));
  console.log('[worker] Shutdown complete.');
}

main().catch((err) => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});
