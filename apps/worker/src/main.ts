/**
 * Worker main process entry point.
 *
 * Independent long-running Node.js process. Cannot rely on web request lifecycle.
 *
 * Usage:
 *   node apps/worker/src/main.js
 *
 * Environment (from .env):
 *   RPC_URL, RPC_FALLBACK_URL, CHAIN_ID,
 *   FACTORY_ADDRESS, RESOLVER_REGISTRY_ADDRESS,
 *   DATABASE_URL, PERSISTENCE_PATH,
 *   WORKER_BATCH_SIZE, WORKER_POLL_INTERVAL_MS
 *
 * E owns; B/D collaborate on event schema and projection mapping.
 */

interface WorkerConfig {
  rpcUrl: string;
  rpcFallbackUrl?: string;
  chainId: number;
  factoryAddress: string;
  resolverRegistryAddress: string;
  persistencePath: string;
  /** How many blocks to fetch per polling batch */
  batchSize: number;
  /** Polling interval in ms */
  pollIntervalMs: number;
}

function loadConfig(): WorkerConfig {
  const missing = (k: string) => {
    if (!process.env[k]) throw new Error(`Missing required env: ${k}`);
    return process.env[k]!;
  };

  return {
    rpcUrl: missing('RPC_URL'),
    rpcFallbackUrl: process.env.RPC_FALLBACK_URL,
    chainId: Number(missing('CHAIN_ID')),
    factoryAddress: missing('FACTORY_ADDRESS'),
    resolverRegistryAddress: missing('RESOLVER_REGISTRY_ADDRESS'),
    persistencePath: missing('PERSISTENCE_PATH'),
    batchSize: Number(process.env.WORKER_BATCH_SIZE ?? '100'),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? '5000'),
  };
}

async function main() {
  const config = loadConfig();

  console.log('[worker] Starting RentBond Worker');
  console.log(`[worker] chain=${config.chainId} factory=${config.factoryAddress}`);
  console.log(`[worker] persistence=${config.persistencePath}`);

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
