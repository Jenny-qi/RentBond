/**
 * Deadline and expiry jobs — idempotent task execution.
 *
 * Jobs are created from confirmed events, then become due at on-chain UTC seconds.
 *
 * Idempotency: tasks check on-chain state before acting; multiple triggers
 * for the same action must not double-execute.
 *
 * E owns; D provides task persistence schema.
 */

import type { Address } from '@rentbond/shared';

/** Job status */
export const JOB_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/** Supported job types — one job per lease per deadline */
export const JOB_TYPE = {
  /** Close claims window and allocate undisputed deductions */
  CLOSE_CLAIMS: 'CLOSE_CLAIMS',
  /** Mark the fallback resolver as timed out after its deadline */
  MARK_SERVICE_TIMEOUT: 'MARK_SERVICE_TIMEOUT',
  /** Trigger timeout exit: dispute goes to tenant */
  FINALIZE_TIMEOUT: 'FINALIZE_TIMEOUT',
} as const;
export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];

/** A persisted job task */
export interface Job {
  id: string;
  type: JobType;
  leaseAddress: Address;
  /** Confirmed event block for rollback and provenance; never a deadline. */
  triggerBlock: bigint;
  /** Confirmed event block timestamp (UTC seconds). */
  triggerTimestamp: number;
  /** Contract deadline in UTC seconds; compare with a confirmed block timestamp. */
  dueAt: bigint;
  caseId?: bigint;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  /** Human-readable last error */
  error?: string;
  createdAt: number;
}

// Re-export scheduler utilities
export * from './scheduler.js';
