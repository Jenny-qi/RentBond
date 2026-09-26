/**
 * Job scheduler — decides which jobs to create based on lease chain state.
 *
 * Triggered by the indexer reaching certain on-chain events.
 * One job per (lease, jobType) pair at any time.
 *
 * E owns; D provides persistence schema.
 */

import type { Address } from '@rentbond/shared';
import type { EscrowEventArgs } from '../indexer/events.js';
import { JOB_TYPE, type Job, type JobType } from './index.js';

/**
 * Job trigger — derived from a specific on-chain event.
 * The block number of that event is the authoritative trigger.
 */
export interface JobTrigger {
  type: JobType;
  leaseAddress: Address;
  triggerBlock: bigint;
  triggerTimestamp: number; // wall-clock for logging only
}

/**
 * Decide whether a new event should create a job.
 * Returns the JobTrigger, or null if no job should be created.
 *
 * Idempotent: same event processed twice → same trigger (Deduplicated by job ID)
 */
export function decideJobTrigger(
  event: EscrowEventArgs,
  triggerBlock: bigint,
  triggerTimestamp: number
): JobTrigger | null {
  switch (event.name) {
    case 'ClaimsOpened': {
      // Claims window just opened — schedule CLOSE_CLAIMS for when it expires
      const claimDeadline = event.args.claimDeadline;
      // The Worker polls and calls closeClaims() when block >= claimDeadline.
      // We create the job now so it can be picked up at the right time.
      return {
        type: JOB_TYPE.CLOSE_CLAIMS,
        leaseAddress: '0x' as Address, // resolved from leaseId → escrow mapping
        triggerBlock: claimDeadline,
        triggerTimestamp,
      };
    }

    case 'CaseOpened': {
      // A case was opened — schedule FINALIZE_PRIMARY for primary deadline
      // (primaryDeadline is in the case, not the event — fetched from contract)
      return {
        type: JOB_TYPE.FINALIZE_PRIMARY,
        leaseAddress: '0x' as Address,
        triggerBlock: 0n, // resolved from on-chain case data
        triggerTimestamp,
      };
    }

    case 'CaseEscalated': {
      // Primary decision was challenged → schedule FINALIZE_FALLBACK
      const fallbackDeadline = event.args.fallbackDeadline;
      return {
        type: JOB_TYPE.FINALIZE_FALLBACK,
        leaseAddress: '0x' as Address,
        triggerBlock: fallbackDeadline,
        triggerTimestamp,
      };
    }

    case 'DecisionFinalized': {
      // A decision was finalized → schedule WITHDRAW_UNALLOCATED
      // (only meaningful if there's still unallocated after settlement)
      return {
        type: JOB_TYPE.WITHDRAW_UNALLOCATED,
        leaseAddress: '0x' as Address,
        triggerBlock: triggerBlock + 1n,
        triggerTimestamp,
      };
    }

    case 'ServiceTimedOut': {
      // Service timeout triggered → schedule FINALIZE_TIMEOUT
      const timeoutAt = event.args.timeoutAt;
      return {
        type: JOB_TYPE.FINALIZE_TIMEOUT,
        leaseAddress: '0x' as Address,
        triggerBlock: timeoutAt,
        triggerTimestamp,
      };
    }

    case 'EscrowExpired': {
      // Hard end reached → schedule EXPIRE_ESCROW
      return {
        type: JOB_TYPE.EXPIRE_ESCROW,
        leaseAddress: '0x' as Address,
        triggerBlock: triggerBlock + 1n,
        triggerTimestamp,
      };
    }

    // These events do not create jobs
    default:
      return null;
  }
}

/**
 * Generate a deterministic job ID from lease and type.
 * Format: "{leaseAddress}/{jobType}"
 */
export function jobId(leaseAddress: Address, type: JobType): string {
  return `${leaseAddress}/${type}`;
}

/**
 * Build a full Job from a JobTrigger.
 * Status is always PENDING at creation time.
 */
export function createJob(trigger: JobTrigger): Job {
  return {
    id: jobId(trigger.leaseAddress, trigger.type),
    type: trigger.type,
    leaseAddress: trigger.leaseAddress,
    triggerBlock: trigger.triggerBlock,
    triggerTimestamp: trigger.triggerTimestamp,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    createdAt: Date.now(),
  };
}
