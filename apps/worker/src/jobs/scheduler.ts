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
 * The confirmed event block proves provenance; deadlines are UTC seconds.
 */
export interface JobTrigger {
  type: JobType;
  leaseAddress: Address;
  triggerBlock: bigint;
  triggerTimestamp: number;
  dueAt: bigint;
  caseId?: bigint;
}

/**
 * Decide whether a new event should create a job.
 * Returns the JobTrigger, or null if no job should be created.
 *
 * Idempotent: same event processed twice → same trigger (Deduplicated by job ID)
 */
export function decideJobTrigger(
  event: EscrowEventArgs,
  leaseAddress: Address,
  triggerBlock: bigint,
  triggerTimestamp: number
): JobTrigger | null {
  if (!/^0x[0-9a-fA-F]{40}$/.test(leaseAddress)) throw new Error('A confirmed escrow address is required');
  if (triggerBlock < 0n || !Number.isSafeInteger(triggerTimestamp) || triggerTimestamp <= 0) {
    throw new Error('A confirmed event block and UTC timestamp are required');
  }
  switch (event.name) {
    case 'ClaimsOpened': {
      const claimDeadline = event.args.claimDeadline;
      if (claimDeadline <= 0n) throw new Error('Invalid claim deadline');
      return {
        type: JOB_TYPE.CLOSE_CLAIMS,
        leaseAddress,
        triggerBlock,
        triggerTimestamp,
        dueAt: claimDeadline,
      };
    }

    case 'CaseEscalated': {
      // No finalizeFallback ABI. F may resolve; after the deadline anyone
      // can markServiceTimeout(caseId), after re-reading on-chain case state.
      const fallbackDeadline = event.args.fallbackDeadline;
      if (fallbackDeadline <= 0n) throw new Error('Invalid fallback deadline');
      return {
        type: JOB_TYPE.MARK_SERVICE_TIMEOUT,
        leaseAddress,
        caseId: event.args.caseId,
        triggerBlock,
        triggerTimestamp,
        dueAt: fallbackDeadline,
      };
    }

    case 'ServiceTimedOut': {
      const timeoutAt = event.args.timeoutAt;
      if (timeoutAt <= 0n) throw new Error('Invalid timeout deadline');
      return {
        type: JOB_TYPE.FINALIZE_TIMEOUT,
        leaseAddress,
        caseId: event.args.caseId,
        triggerBlock,
        triggerTimestamp,
        dueAt: timeoutAt,
      };
    }

    // These events do not create jobs
    default:
      return null;
  }
}

/**
 * Generate a deterministic job ID from lease and type.
 * Format: "{leaseAddress}/{jobType}[/caseId]"
 */
export function jobId(leaseAddress: Address, type: JobType, caseId?: bigint): string {
  return `${leaseAddress.toLowerCase()}/${type}/${caseId === undefined ? 'lease' : caseId.toString()}`;
}

/**
 * Build a full Job from a JobTrigger.
 * Status is always PENDING at creation time.
 */
export function createJob(trigger: JobTrigger): Job {
  return {
    id: jobId(trigger.leaseAddress, trigger.type, trigger.caseId),
    type: trigger.type,
    leaseAddress: trigger.leaseAddress,
    triggerBlock: trigger.triggerBlock,
    triggerTimestamp: trigger.triggerTimestamp,
    dueAt: trigger.dueAt,
    caseId: trigger.caseId,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    createdAt: Date.now(),
  };
}
