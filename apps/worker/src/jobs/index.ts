/**
 * Deadline and expiry jobs — idempotent task execution.
 *
 * Jobs are triggered by the indexer reaching certain on-chain state
 * (e.g., claims window closed, primary deadline reached, hardEndAt reached).
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
  /** Finalize primary resolver decision if unchallenged */
  FINALIZE_PRIMARY: 'FINALIZE_PRIMARY',
  /** Finalize fallback resolver decision */
  FINALIZE_FALLBACK: 'FINALIZE_FALLBACK',
  /** Trigger timeout exit: dispute goes to tenant */
  FINALIZE_TIMEOUT: 'FINALIZE_TIMEOUT',
  /** Finalize hard end: release remaining unallocated to tenant */
  EXPIRE_ESCROW: 'EXPIRE_ESCROW',
  /** Move any remaining unallocated balance to tenant after all settlements */
  WITHDRAW_UNALLOCATED: 'WITHDRAW_UNALLOCATED',
} as const;
export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];

/** A persisted job task */
export interface Job {
  id: string;
  type: JobType;
  leaseAddress: Address;
  /**
   * On-chain block number that triggered this job.
   * Task is only safe to execute when currentBlock >= triggerBlock.
   * NOT wall-clock time — prevents retry loops from extending deadlines.
   */
  triggerBlock: bigint;
  /**
   * Approximate wall-clock trigger time (UTC seconds) for logging/debugging.
   * Never used as the authoritative trigger — chain state is authoritative.
   */
  triggerTimestamp: number;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  /** Human-readable last error */
  error?: string;
  createdAt: number;
}
