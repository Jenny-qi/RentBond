import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import { loadWorkerConfig } from './config.ts';
import { createWorkerRpc } from './rpc.mjs';
import { runIndexerCycle } from './indexer/loop.ts';
import { runExecutorCycle } from './jobs/executor.ts';
import { openDatabase, migrate } from '../../web/src/server/db.ts';
import { createChain } from '../../web/src/server/chain.ts';
import { createStorage } from '../../web/src/server/storage.ts';
import { createScanner } from '../../web/src/server/scanner.ts';

export async function runWorker(app: any, rpc: any, config: any, options: { once?: boolean; signal?: AbortSignal } = {}) {
  while (!options.signal?.aborted) {
    try {
      const indexed = await runIndexerCycle(app, rpc, config);
      // Catch up before signing: an outdated projection is not a write preflight.
      if (config.execute && indexed.caughtUp) await runExecutorCycle(app, rpc);
    } catch {
      console.error('[worker] CYCLE_FAILED; writes paused for this cycle');
      if (options.once) throw new Error('WORKER_CYCLE_FAILED');
    }
    if (options.once) break;
    try { await setTimeout(config.pollIntervalMs, undefined, { signal: options.signal }); }
    catch (error) { if (!options.signal?.aborted) throw error; }
  }
}

export async function main() {
  const config = loadWorkerConfig();
  let account;
  if (config.execute) {
    const key = (await readFile(config.keyFile!, 'utf8')).trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Invalid Worker key file');
    account = privateKeyToAccount(key as `0x${string}`);
    if (account.address.toLowerCase() !== config.workerGasAccount) throw new Error('WORKER_SIGNER_MISMATCH');
    if (config.sponsorKey && privateKeyToAccount(config.sponsorKey as `0x${string}`).address.toLowerCase() === config.workerGasAccount) throw new Error('Worker and gas sponsor must be separate accounts');
  }
  const db = await openDatabase(config);
  const stop = new AbortController();
  const shutdown = () => stop.abort();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await migrate(db);
    const app = { config, db, chain: createChain(config), storage: createStorage(config),
      quarantine: createStorage(config, true), scanner: createScanner(config), now: Date.now };
    const rpc = createWorkerRpc(config, account);
    console.log(`[worker] chain=${config.chainId} execution=${config.execute} storage=database`);
    await runWorker(app, rpc, config, { once: process.argv.includes('--once'), signal: stop.signal });
  } finally {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
    await db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('[worker] START_OR_CYCLE_FAILED; check configuration and service availability'); process.exitCode = 1; });
}
