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

/** Supported job types */
export const JOB_TYPE = {
  CLOSE_CLAIMS: 'CLOSE_CLAIMS',
  FINALIZE_PRIMARY: 'FINALIZE_PRIMARY',
  FINALIZE_FALLBACK: 'FINALIZE_FALLBACK',
  FINALIZE_TIMEOUT: 'FINALIZE_TIMEOUT',
  EXPIRE_ESCROW: 'EXPIRE_ESCROW',
  WITHDRAW_UNALLOCATED: 'WITHDRAW_UNALLOCATED',
} as const;
export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];

/** A persisted job task */
export interface Job {
  id: string;
  type: JobType;
  leaseAddress: Address;
  /** On-chain trigger block (not wall-clock) */
  triggerBlock: number;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
}
