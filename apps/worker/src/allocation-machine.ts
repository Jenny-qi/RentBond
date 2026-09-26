/**
 * Allocation state machine — validates and applies state transitions.
 *
 * Enforces the conservation invariant after every transition.
 * Used by the indexer to reject invalid event sequences.
 *
 * E owns; B reviews state transition rules.
 */

import { verifyAllocationConservation } from '@rentbond/shared';
import type { AllocationState } from './indexer/allocation.js';

/** Errors for invalid allocation transitions */
export class AllocationTransitionError extends Error {
  constructor(
    message: string,
    public readonly fromState: AllocationState,
    public readonly eventName: string
  ) {
    super(message);
    this.name = 'AllocationTransitionError';
  }
}

/**
 * Advance an allocation state with a new accounting entry.
 * Throws AllocationTransitionError if the transition is invalid.
 *
 * @param state   Current state (must satisfy conservation invariant)
 * @param delta   Field to change
 * @param amount  Amount to add (positive) or subtract (negative)
 */
export function applyAllocationDelta(
  state: AllocationState,
  delta: keyof Omit<AllocationState, 'fundedAmount'>,
  amount: bigint
): AllocationState {
  // Verify current state is valid first
  try {
    verifyAllocationConservation(state.fundedAmount, {
      unallocated: state.unallocated,
      tenantCredit: state.tenantCredit,
      landlordCredit: state.landlordCredit,
      tenantWithdrawn: state.tenantWithdrawn,
      landlordWithdrawn: state.landlordWithdrawn,
    });
  } catch {
    throw new AllocationTransitionError(
      `Conservation invariant violated in current state`,
      state,
      '(unknown)'
    );
  }

  const current = BigInt(state[delta]);
  const next = current + amount;

  if (next < 0n) {
    throw new AllocationTransitionError(
      `Negative ${delta}: current=${current} amount=${amount}`,
      state,
      delta
    );
  }

  const nextState = { ...state, [delta]: next.toString() };

  // Verify conservation holds after transition
  try {
    verifyAllocationConservation(nextState.fundedAmount, {
      unallocated: nextState.unallocated,
      tenantCredit: nextState.tenantCredit,
      landlordCredit: nextState.landlordCredit,
      tenantWithdrawn: nextState.tenantWithdrawn,
      landlordWithdrawn: nextState.landlordWithdrawn,
    });
  } catch {
    throw new AllocationTransitionError(
      `Conservation violated after ${delta}+=${amount}`,
      state,
      delta
    );
  }

  return nextState;
}

/**
 * Check if an allocation is fully settled — no unallocated, no credits.
 * Used to determine if WITHDRAW_UNALLOCATED is relevant.
 */
export function isFullySettled(state: AllocationState): boolean {
  return (
    BigInt(state.unallocated) === 0n &&
    BigInt(state.tenantCredit) === 0n &&
    BigInt(state.landlordCredit) === 0n
  );
}

/**
 * Check if all credits have been withdrawn.
 * Used to determine if a lease is CLOSED.
 */
export function isFullyWithdrawn(state: AllocationState): boolean {
  return (
    isFullySettled(state) &&
    BigInt(state.tenantWithdrawn) + BigInt(state.landlordWithdrawn) >=
      BigInt(state.fundedAmount)
  );
}

/**
 * The total amount claimable by the tenant.
 * (fundedAmount - landlord's share already withdrawn)
 */
export function tenantTotal(state: AllocationState): bigint {
  return (
    BigInt(state.fundedAmount) -
    BigInt(state.landlordWithdrawn) -
    BigInt(state.landlordCredit)
  );
}

/**
 * The total amount claimable by the landlord.
 * (accepted deductions + credits)
 */
export function landlordTotal(state: AllocationState): bigint {
  return BigInt(state.landlordCredit) + BigInt(state.landlordWithdrawn);
}
