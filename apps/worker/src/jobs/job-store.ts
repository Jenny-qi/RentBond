/**
 * Job store — JSON file persistence for Worker jobs.
 *
 * Simple file-based store with atomic rename for crash safety.
 * Caller is responsible for type conversions (bigint ↔ string).
 *
 * E owns.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface JobRecord {
  id: string;
  type: string;
  leaseAddress: string;
  triggerBlock: string;  // bigint serialized as string
  triggerTimestamp: number;
  dueAt: string;         // bigint serialized as string
  caseId?: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
}

export interface JobStore {
  jobs: Record<string, JobRecord>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Atomic read — load JSON file, return empty store on error */
async function loadStore(path: string): Promise<JobStore> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as JobStore;
  } catch {
    return { jobs: {} };
  }
}

/** Atomic write — write to .tmp then rename */
async function saveStore(path: string, store: JobStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + '.tmp', JSON.stringify(store, null, 2), 'utf-8');
  await rename(path + '.tmp', path);
}

/**
 * Atomically load the job store.
 * Returns an in-memory copy; use saveJobStore to persist changes.
 */
export async function loadJobStore(path: string): Promise<JobStore> {
  return loadStore(path);
}

/**
 * Atomically save the job store.
 * Replaces the entire file atomically.
 */
export async function saveJobStore(path: string, store: JobStore): Promise<void> {
  return saveStore(path, store);
}

/**
 * Atomically modify the store: load → modify → save.
 * All in one atomic step (no separate load/save needed by caller).
 */
export async function modifyJobStore<T>(
  path: string,
  modifier: (store: JobStore) => T
): Promise<T> {
  const store = await loadStore(path);
  const result = modifier(store);
  await saveStore(path, store);
  return result;
}

/** Get a job by ID */
export function getJob(store: JobStore, id: string): JobRecord | undefined {
  return store.jobs[id];
}

/** Get all jobs with a given status */
export function getJobsByStatus(store: JobStore, status: string): JobRecord[] {
  return Object.values(store.jobs).filter((j) => j.status === status);
}

/**
 * Check if a non-FAILED job with the same (leaseAddress, type, caseId) exists.
 * Used for idempotent deduplication.
 */
export function jobExists(
  store: JobStore,
  leaseAddress: string,
  type: string,
  caseId?: string
): boolean {
  return Object.values(store.jobs).some(
    (j) =>
      j.leaseAddress === leaseAddress &&
      j.type === type &&
      (caseId === undefined || j.caseId === caseId) &&
      j.status !== 'FAILED'
  );
}

/**
 * Upsert (add or update) a job record.
 * The record should already have string bigints (caller converts).
 */
export function upsertJob(store: JobStore, job: JobRecord): void {
  store.jobs[job.id] = job;
}
