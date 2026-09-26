/**
 * Lease status projection — maps on-chain events to LeaseStatus.
 *
 * Mirrors DepositEscrow.Phase enum transitions.
 * The on-chain Phase is authoritative; this projection is for DB/UI convenience.
 *
 * E owns; B reviews phase transition logic.
 */

import type { Address } from '@rentbond/shared';
import type { EscrowEventArgs } from './events.js';
import type { LeaseStatus } from '@rentbond/shared';
import { LEASE_STATUS } from '@rentbond/shared';

/**
 * Given the current status and a new event, compute the next status.
 * This is a pure function — no side effects, no RPC calls.
 *
 * Note: CheckoutCase is a special resolver case, not a simple phase.
 * The status can only move forward; there is no backward transition
 * (except Cancelled which is terminal).
 */
export function projectStatus(
  current: LeaseStatus,
  event: EscrowEventArgs
): LeaseStatus {
  switch (event.name) {
    case 'TermsAccepted':
      return LEASE_STATUS.AWAITING_FUNDING;

    case 'Funded':
      return LEASE_STATUS.ACTIVE;

    case 'CheckoutRequested':
      return LEASE_STATUS.CHECKOUT_REQUESTED;

    case 'CheckoutCaseOpened':
      return LEASE_STATUS.CHECKOUT_CASE;

    case 'CheckoutCaseResolved':
    case 'CheckoutResponded': {
      // If agree=true the case goes to ClaimsOpen; if not, it returns to Active
      if (event.name === 'CheckoutCaseResolved') {
        return event.args.approved
          ? LEASE_STATUS.CLAIMS_OPEN
          : LEASE_STATUS.ACTIVE;
      }
      // CheckoutResponded with agree=true → ClaimsOpen
      return event.args.agree ? LEASE_STATUS.CLAIMS_OPEN : LEASE_STATUS.ACTIVE;
    }

    case 'ClaimsOpened':
      return LEASE_STATUS.CLAIMS_OPEN;

    // ClaimsSubmitted moves to CLAIMS_REVIEW — waiting for tenant response
    case 'ClaimsSubmitted':
      return LEASE_STATUS.CLAIMS_REVIEW;

    // ClaimsClosed: no more claims possible, move to CLAIM_CASE or EXIT_PENDING
    case 'ClaimsClosed':
      return LEASE_STATUS.EXIT_PENDING;

    case 'CaseOpened':
      return LEASE_STATUS.CLAIM_CASE;

    case 'DecisionProposed':
      // Still in CLAIM_CASE, case is in Proposed phase
      return current; // stay in CLAIM_CASE

    case 'CaseEscalated':
      // Challenged — still CLAIM_CASE
      return current;

    case 'DecisionFinalized':
    case 'ServiceTimedOut':
    case 'TimeoutAllocated':
    case 'SettlementConfirmed':
      // All finalize the dispute — return to EXIT_PENDING
      return LEASE_STATUS.EXIT_PENDING;

    case 'EscrowExpired':
      return LEASE_STATUS.ALLOCATED;

    case 'LeaseCancelled':
      return LEASE_STATUS.CANCELLED;

    default:
      return current;
  }
}

/** Map a contract Phase number to a LeaseStatus string */
export function phaseToStatus(phase: number): LeaseStatus {
  // DepositEscrow.Phase enum order:
  // 0=AwaitingAcceptance, 1=AwaitingFunding, 2=Active,
  // 3=CheckoutRequested, 4=CheckoutCase, 5=ClaimsOpen,
  // 6=ClaimsReview, 7=ClaimCase, 8=ExitPending,
  // 9=Cancelled, 10=Allocated, 11=Closed
  const phases: LeaseStatus[] = [
    LEASE_STATUS.AWAITING_ACCEPTANCE,
    LEASE_STATUS.AWAITING_FUNDING,
    LEASE_STATUS.ACTIVE,
    LEASE_STATUS.CHECKOUT_REQUESTED,
    LEASE_STATUS.CHECKOUT_CASE,
    LEASE_STATUS.CLAIMS_OPEN,
    LEASE_STATUS.CLAIMS_REVIEW,
    LEASE_STATUS.CLAIM_CASE,
    LEASE_STATUS.EXIT_PENDING,
    LEASE_STATUS.CANCELLED,
    LEASE_STATUS.ALLOCATED,
    LEASE_STATUS.CLOSED,
  ];
  return phases[phase] ?? LEASE_STATUS.AWAITING_ACCEPTANCE;
}
