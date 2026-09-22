/**
 * Core domain types for leases, cases, and transactions.
 *
 * E maintains; B reviews contract types; D reviews persistence types.
 */

import type { Address, Hash, Timestamp } from './primitives.js';

/**
 * Lease lifecycle states — mirrors DepositEscrow.Phase enum from B's contract.
 *
 * Source: contracts/src/DepositEscrow.sol enum Phase
 */
export const LEASE_STATUS = {
  AWAITING_ACCEPTANCE: 'AWAITING_ACCEPTANCE',
  AWAITING_FUNDING: 'AWAITING_FUNDING',
  ACTIVE: 'ACTIVE',
  CHECKOUT_REQUESTED: 'CHECKOUT_REQUESTED',
  CHECKOUT_CASE: 'CHECKOUT_CASE',
  CLAIMS_OPEN: 'CLAIMS_OPEN',
  CLAIMS_REVIEW: 'CLAIMS_REVIEW',
  CLAIM_CASE: 'CLAIM_CASE',
  EXIT_PENDING: 'EXIT_PENDING',
  CANCELLED: 'CANCELLED',
  ALLOCATED: 'ALLOCATED',
  CLOSED: 'CLOSED',
} as const;
export type LeaseStatus = (typeof LEASE_STATUS)[keyof typeof LEASE_STATUS];

/** Claim item status — mirrors DepositEscrow.ClaimStatus from B's contract */
export const CLAIM_RESPONSE = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DISPUTED: 'Disputed',
  WAIVED: 'Waived',
  ALLOCATED: 'Allocated',
} as const;
export type ClaimResponse = (typeof CLAIM_RESPONSE)[keyof typeof CLAIM_RESPONSE];

/** Transaction states — distinguish signing/pending/confirmed/failed */
export const TX_STATUS = {
  AWAITING_SIGNATURE: 'AWAITING_SIGNATURE',
  SUBMITTED: 'SUBMITTED',
  CONFIRMING: 'CONFIRMING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type TxStatus = (typeof TX_STATUS)[keyof typeof TX_STATUS];

/**
 * Case processing phases — mirrors DepositEscrow.CasePhase from B's contract.
 *
 * Source: contracts/src/DepositEscrow.sol enum CasePhase
 */
export const CASE_STATUS = {
  NONE: 'None',
  PRIMARY: 'Primary',
  PROPOSED: 'Proposed',
  FALLBACK: 'Fallback',
  EXIT_PENDING: 'ExitPending',
  FINALIZED: 'Finalized',
} as const;
export type CaseStatus = (typeof CASE_STATUS)[keyof typeof CASE_STATUS];

/** Lease role */
export const ROLE = {
  TENANT: 'TENANT',
  LANDLORD: 'LANDLORD',
  RESOLVER: 'RESOLVER',
  FALLBACK: 'FALLBACK',
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

/**
 * Deposit allocation snapshot — mirrors DepositEscrow.Accounting from B's contract.
 *
 * Conservation invariant (all amounts in base units):
 *   fundedAmount = unallocated + tenantCredit + landlordCredit
 *                + tenantWithdrawn + landlordWithdrawn
 *
 * Use `verifyAllocationConservation()` from @rentbond/shared to check this.
 *
 * Source: contracts/src/DepositEscrow.sol struct Accounting
 */
export interface AllocationSnapshot {
  /** Chain ID for cross-network disambiguation */
  chainId: number;
  /** Contract address this snapshot refers to */
  contractAddress: Address;
  /** Total deposited amount (set at fund time, never changes) */
  fundedAmount: string;
  unallocated: string;        // base units string
  tenantCredit: string;
  landlordCredit: string;
  tenantWithdrawn: string;
  landlordWithdrawn: string;
  /** Chain block when this snapshot was computed */
  lastSyncedBlock: number;
  /** Whether this snapshot is confirmed on-chain */
  confirmed: boolean;
  /** schemaVersion for cache invalidation */
  schemaVersion: string;
}

/** Claim item submitted by landlord */
export interface ClaimItem {
  id: number; // 0-9
  category: string;
  amountBaseUnits: string;
  response: ClaimResponse;
}

/** Minimal lease info returned by /api/leases */
export interface LeaseSummary {
  id: string;
  status: LeaseStatus;
  depositBaseUnits: string;
  leaseEndAt: Timestamp;
  hardEndAt: Timestamp;
  tenantAddress: Address;
  landlordAddress: Address;
}

/** On-chain lease state as projected from events */
export interface LeaseState {
  chainId: number;
  address: Address;
  status: LeaseStatus;
  deposit: string;           // base units
  tenant: Address;
  landlord: Address;
  resolver: Address;
  fallback: Address;
  serviceRegistry: Address;
  claimsWindowEnd: Timestamp;
  primaryDeadline: Timestamp;
  fallbackDeadline: Timestamp;
  hardEndAt: Timestamp;
  allocation: AllocationSnapshot | null;
}
