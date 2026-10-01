/**
 * Job executor — executes due Worker jobs against on-chain DepositEscrow.
 *
 * Flow: indexer emits trigger → scheduler creates Job → executor picks it up
 * when dueAt is reached → escrowCaller sends tx → job marked COMPLETED/FAILED.
 *
 * Idempotency: every action reads on-chain state before writing.
 * Retry: jobs with status FAILED are retried up to maxAttempts times.
 *
 * E owns.
 */

import type { Address } from '@rentbond/shared';
import type { PublicClient } from '../indexer/providers.js';
import { buildPublicClient } from '../indexer/providers.js';
import type { EscrowCaller } from '../indexer/escrow-caller.js';
import { buildEscrowCaller } from '../indexer/escrow-caller.js';

import {
  JOB_STATUS,
  JOB_TYPE,
  type Job,
  type JobStatus,
} from './index.js';

import {
  type JobRecord,
  loadJobStore,
  saveJobStore,
  upsertJob,
  getJobsByStatus,
  modifyJobStore,
} from './job-store.js';

// ---------------------------------------------------------------------------
// Types (bridge between Job <-> JobRecord)
// ---------------------------------------------------------------------------

/** Convert Job (with bigints) to JobRecord (with string bigints) for persistence */
function jobToRecord(job: Job): JobRecord {
  return {
    id: job.id,
    type: job.type,
    leaseAddress: job.leaseAddress,
    triggerBlock: job.triggerBlock.toString(),
    triggerTimestamp: job.triggerTimestamp,
    dueAt: job.dueAt.toString(),
    caseId: job.caseId?.toString(),
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    lastAttemptAt: job.lastAttemptAt,
    error: job.error,
    createdAt: job.createdAt,
  };
}

/** Convert JobRecord (with string bigints) to Job */
function recordToJob(rec: JobRecord): Job {
  return {
    id: rec.id,
    type: rec.type as Job['type'],
    leaseAddress: rec.leaseAddress as Address,
    triggerBlock: BigInt(rec.triggerBlock),
    triggerTimestamp: rec.triggerTimestamp,
    dueAt: BigInt(rec.dueAt),
    caseId: rec.caseId ? BigInt(rec.caseId) : undefined,
    status: rec.status as JobStatus,
    attempts: rec.attempts,
    maxAttempts: rec.maxAttempts,
    lastAttemptAt: rec.lastAttemptAt,
    error: rec.error,
    createdAt: rec.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export interface ExecutorConfig {
  rpcUrl: string;
  workerGasAccount: Address;
  persistencePath: string;
  pollIntervalMs: number;
  chainId: number;
}

let running = true;

export async function startExecutor(config: ExecutorConfig): Promise<void> {
  console.log(`[EXECUTOR] Starting — worker=${config.workerGasAccount}`);

  const publicClient = await buildPublicClient({
    primaryUrl: config.rpcUrl,
    network: { chainId: config.chainId, name: 'Monad Testnet', rpcUrl: config.rpcUrl, finalityBlocks: 1, nativeCurrency: 'MON', explorerUrl: '' } as any,
  });

  const escrowCaller = await buildEscrowCaller({
    rpcUrl: config.rpcUrl,
    signer: { address: config.workerGasAccount },
    network: { chainId: config.chainId, name: 'Monad Testnet' } as any,
  });

  const storePath = `${config.persistencePath}/jobs.json`;
  const store = await loadJobStore(storePath);
  const initialCount = Object.keys(store.jobs).length;
  console.log(`[EXECUTOR] Loaded ${initialCount} jobs from ${storePath}`);

  const shutdown = async () => {
    console.log('[EXECUTOR] Shutting down...');
    running = false;
    await saveJobStore(storePath, store);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  while (running) {
    try {
      const processed = await runCycle(publicClient, escrowCaller, config, store, storePath);
      if (processed) await saveJobStore(storePath, store);
    } catch (err) {
      console.error('[EXECUTOR] Cycle error:', err);
    }
    await sleep(config.pollIntervalMs);
  }

  await saveJobStore(storePath, store);
  console.log('[EXECUTOR] Exited.');
}

async function runCycle(
  publicClient: PublicClient,
  escrowCaller: EscrowCaller,
  config: ExecutorConfig,
  store: import('./job-store.js').JobStore,
  storePath: string
): Promise<boolean> {
  // Use block timestamp as approximation (no block.getTime in fetch-based client)
  const nowSec = Math.floor(Date.now() / 1000);
  let anyProcessed = false;

  // PENDING jobs that are now due
  for (const rec of getJobsByStatus(store, JOB_STATUS.PENDING)) {
    if (nowSec < Number(BigInt(rec.dueAt))) continue;
    anyProcessed = true;
    await executeJob(recordToJob(rec), escrowCaller, store);
  }

  // FAILED jobs eligible for retry
  for (const rec of getJobsByStatus(store, JOB_STATUS.FAILED)) {
    if (nowSec < Number(BigInt(rec.dueAt))) continue;
    const job = recordToJob(rec);
    if (job.attempts >= job.maxAttempts) continue;
    anyProcessed = true;
    await executeJob(job, escrowCaller, store);
  }

  return anyProcessed;
}

async function executeJob(
  job: Job,
  escrowCaller: EscrowCaller,
  store: import('./job-store.js').JobStore
): Promise<void> {
  console.log(`[EXECUTOR] ${job.id} attempt ${job.attempts + 1}/${job.maxAttempts}`);

  // Mark RUNNING
  const rec = jobToRecord({ ...job, status: JOB_STATUS.RUNNING, attempts: job.attempts + 1, lastAttemptAt: Date.now(), error: undefined });
  upsertJob(store, rec);

  let result: { success: boolean; txHash?: string; revertReason?: string };

  try {
    switch (job.type) {
      case JOB_TYPE.CLOSE_CLAIMS:
        result = await escrowCaller.closeClaims(job.leaseAddress);
        break;
      case JOB_TYPE.MARK_SERVICE_TIMEOUT:
        result = job.caseId
          ? await escrowCaller.finalizeTimeout(job.leaseAddress, job.caseId)
          : { success: false, revertReason: 'caseId required' };
        break;
      case JOB_TYPE.FINALIZE_TIMEOUT:
        result = job.caseId
          ? await escrowCaller.finalizeTimeout(job.leaseAddress, job.caseId)
          : { success: false, revertReason: 'caseId required' };
        break;
      default:
        result = { success: false, revertReason: `Unknown job type: ${job.type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[EXECUTOR] ${job.id} exception: ${msg}`);
    const updated = jobToRecord({ ...job, status: JOB_STATUS.FAILED, error: msg });
    upsertJob(store, updated);
    return;
  }

  if (result.success) {
    console.log(`[EXECUTOR] ${job.id} succeeded txHash=${result.txHash ?? 'n/a'}`);
    upsertJob(store, jobToRecord({ ...job, status: JOB_STATUS.COMPLETED, error: undefined }));
  } else {
    const reason = result.revertReason ?? 'unknown';
    const permanent = isPermanentFailure(reason);
    const finalStatus = permanent || job.attempts >= job.maxAttempts ? JOB_STATUS.FAILED : JOB_STATUS.PENDING;
    console.warn(`[EXECUTOR] ${job.id} failed (permanent=${permanent}): ${reason}`);
    upsertJob(store, jobToRecord({ ...job, status: finalStatus, error: reason }));
  }
}

function isPermanentFailure(reason: string): boolean {
  return /already (closed|finalized|expired|resolved|cancelled)/i.test(reason)
    || /claim already/i.test(reason)
    || /deadline not reached/i.test(reason);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
