/**
 * Allocation projection — applies on-chain events to the accounting snapshot.
 *
 * Mirrors DepositEscrow.Accounting mutations from B's contract.
 * Called idempotently by the indexer for each processed event.
 *
 * The fundamental invariant maintained here:
 *   fundedAmount = unallocated + tenantCredit + landlordCredit
 *               + tenantWithdrawn + landlordWithdrawn
 *
 * E owns; B reviews accounting logic.
 */

import type { Address } from '@rentbond/shared';
import type { EscrowEventArgs } from './events.js';

/** Allocation snapshot — mirrors DepositEscrow.Accounting struct */
export interface AllocationState {
  fundedAmount: string;
  unallocated: string;
  tenantCredit: string;
  landlordCredit: string;
  tenantWithdrawn: string;
  landlordWithdrawn: string;
}

/** Build a zero allocation snapshot */
export function zeroAllocation(): AllocationState {
  return {
    fundedAmount: '0',
    unallocated: '0',
    tenantCredit: '0',
    landlordCredit: '0',
    tenantWithdrawn: '0',
    landlordWithdrawn: '0',
  };
}

/**
 * Apply a decoded Escrow event to an AllocationState.
 * This is the core projection function used by the indexer.
 *
 * @param state     Current allocation snapshot
 * @param event     Discriminated event with name and args
 * @param tenant    Lease tenant address — used to route beneficiary credits
 *
 * Events that affect accounting:
 * - Funded              → set fundedAmount, init unallocated
 * - CreditAllocated     → add to tenantCredit or landlordCredit per beneficiary/source
 * - Withdrawn           → move credit → withdrawn per beneficiary
 * - ClaimsClosed        → move unclaimed → tenantCredit, accepted → landlordCredit
 * - SettlementConfirmed  → apply settlement split
 * - EscrowExpired       → remaining unallocated → tenantCredit (timeout policy)
 */
export function applyEventToAllocation(
  state: AllocationState,
  event: EscrowEventArgs,
  tenant: Address
): AllocationState {
  switch (event.name) {

    case 'Funded': {
      const amount = event.args.amount.toString();
      return {
        ...state,
        fundedAmount: amount,
        unallocated: amount,
      };
    }

    case 'CreditAllocated': {
      const amount = event.args.amount.toString();
      const beneficiary = event.args.beneficiary;
      if (beneficiary.toLowerCase() === tenant.toLowerCase()) {
        return { ...state, tenantCredit: addStrings(state.tenantCredit, amount) };
      } else {
        return { ...state, landlordCredit: addStrings(state.landlordCredit, amount) };
      }
    }

    case 'Withdrawn': {
      const amount = event.args.amount.toString();
      const beneficiary = event.args.beneficiary;
      if (beneficiary.toLowerCase() === tenant.toLowerCase()) {
        return { ...state, tenantWithdrawn: addStrings(state.tenantWithdrawn, amount) };
      } else {
        return { ...state, landlordWithdrawn: addStrings(state.landlordWithdrawn, amount) };
      }
    }

    case 'ClaimsClosed': {
      // unclaimedAmount → tenantCredit (Alice's 700)
      // acceptedAmount → landlordCredit (the 100 Alice accepted)
      const unclaimed = event.args.unclaimedAmount.toString();
      const accepted = event.args.acceptedAmount.toString();
      return {
        ...state,
        unallocated: subtractStrings(state.unallocated, addStrings(unclaimed, accepted)),
        tenantCredit: addStrings(state.tenantCredit, unclaimed),
        landlordCredit: addStrings(state.landlordCredit, accepted),
      };
    }

    case 'SettlementConfirmed': {
      // Settlement overrides whatever the disputed amount was
      const tenantShare = event.args.tenantShare.toString();
      const landlordShare = event.args.landlordShare.toString();
      const settled = addStrings(tenantShare, landlordShare);
      return {
        ...state,
        unallocated: subtractStrings(state.unallocated, settled),
        tenantCredit: addStrings(state.tenantCredit, tenantShare),
        landlordCredit: addStrings(state.landlordCredit, landlordShare),
      };
    }

    case 'EscrowExpired': {
      // Timeout policy: remaining unallocated → tenantCredit
      // (hardEndAt passed with no resolution — default to tenant per contract policy)
      const remaining = state.unallocated;
      if (BigInt(remaining) === 0n) return state;
      return {
        ...state,
        unallocated: '0',
        tenantCredit: addStrings(state.tenantCredit, remaining),
      };
    }

    // The following events record state but do not change accounting balances.
    // Their effects are reflected in other events or on-chain reads.
    case 'TermsAccepted':
    case 'LeaseCancelled':
    case 'ClaimsOpened':
    case 'ClaimsSubmitted':
    case 'ClaimResponded':
    case 'ClaimWaived':
    case 'CaseOpened':
    case 'DecisionProposed':
    case 'CaseEscalated':
    case 'DecisionFinalized':
    case 'ServiceTimedOut':
    case 'TimeoutAllocated':
    case 'SettlementProposed':
    case 'EvidenceCommitted':
    case 'EvidenceAcknowledged':
    case 'CheckoutRequested':
    case 'CheckoutResponded':
    case 'CheckoutCaseOpened':
    case 'CheckoutCaseResolved':
      return state;

    default:
      return state;
  }
}

function addStrings(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

function subtractStrings(a: string, b: string): string {
  return (BigInt(a) - BigInt(b)).toString();
}
