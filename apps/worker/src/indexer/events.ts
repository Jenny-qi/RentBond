/**
 * Typed event argument interfaces — generated from deployments/abi/.
 *
 * These are the authoritative TypeScript types for decoding on-chain events
 * emitted by DepositEscrow and LeaseFactory.
 *
 * Generated from: deployments/abi/DepositEscrow.json and LeaseFactory.json
 * Source commit: see deployments/abi/manifest.json
 *
 * E owns; B reviews function signatures and event semantics.
 */

import type { Address, Hash } from '@rentbond/shared';

/** DepositEscrow event argument types */
export interface CaseEscalatedArgs {
  leaseId: Hash;
  caseId: bigint;
  challenger: Address;
  challengeCommitment: Hash;
  fallbackDeadline: bigint;
}

export interface CaseOpenedArgs {
  leaseId: Hash;
  caseId: bigint;
  caseType: bigint; // enum DepositEscrow.CaseType
  disputedAmount: bigint;
}

export interface CheckoutCaseOpenedArgs {
  leaseId: Hash;
  requester: Address;
}

export interface CheckoutCaseResolvedArgs {
  leaseId: Hash;
  caseId: bigint;
  approved: boolean;
}

export interface CheckoutRequestedArgs {
  leaseId: Hash;
  requester: Address;
  evidenceHash: Hash;
  responseDeadline: bigint;
}

export interface CheckoutRespondedArgs {
  leaseId: Hash;
  responder: Address;
  agree: boolean;
  evidenceHash: Hash;
}

export interface ClaimRespondedArgs {
  leaseId: Hash;
  claimId: bigint;
  accepted: boolean;
  responseCommitment: Hash;
}

export interface ClaimWaivedArgs {
  leaseId: Hash;
  claimId: bigint;
}

export interface ClaimsClosedArgs {
  leaseId: Hash;
  unclaimedAmount: bigint;
  acceptedAmount: bigint;
  disputedAmount: bigint;
}

export interface ClaimsOpenedArgs {
  leaseId: Hash;
  claimDeadline: bigint;
}

export interface ClaimsSubmittedArgs {
  leaseId: Hash;
  landlord: Address;
  claimCount: bigint;
  tenantShare: bigint;
  totalAmount: bigint;
}

export interface CreditAllocatedArgs {
  leaseId: Hash;
  beneficiary: Address;
  amount: bigint;
  source: Hash;
}

export interface DecisionFinalizedArgs {
  leaseId: Hash;
  caseId: bigint;
  decisionHash: Hash;
}

export interface DecisionProposedArgs {
  leaseId: Hash;
  caseId: bigint;
  resolver: Address;
  decisionHash: Hash;
  challengeDeadline: bigint;
}

export interface EscrowExpiredArgs {
  leaseId: Hash;
  amount: bigint;
}

export interface EvidenceAcknowledgedArgs {
  leaseId: Hash;
  submitter: Address;
  version: bigint;
  acknowledger: Address;
  agree: boolean;
}

export interface EvidenceCommittedArgs {
  leaseId: Hash;
  submitter: Address;
  version: bigint;
  bundleId: Hash;
  commitment: Hash;
}

export interface FundedArgs {
  leaseId: Hash;
  tenant: Address;
  amount: bigint;
  serviceProfileId: Hash;
}

export interface LeaseCancelledArgs {
  leaseId: Hash;
  caller: Address;
  reason: Hash;
}

export interface ServiceTimedOutArgs {
  leaseId: Hash;
  caseId: bigint;
  timeoutAt: bigint;
}

export interface SettlementConfirmedArgs {
  leaseId: Hash;
  proposalId: bigint;
  tenantShare: bigint;
  landlordShare: bigint;
}

export interface SettlementProposedArgs {
  leaseId: Hash;
  proposalId: bigint;
  proposer: Address;
  tenantShare: bigint;
  landlordShare: bigint;
  snapshotRevision: bigint;
  validUntil: bigint;
  detailsHash: Hash;
}

export interface TermsAcceptedArgs {
  leaseId: Hash;
  tenant: Address;
  termsHash: Hash;
}

export interface TimeoutAllocatedArgs {
  leaseId: Hash;
  caseId: bigint;
  amount: bigint;
}

export interface WithdrawnArgs {
  leaseId: Hash;
  beneficiary: Address;
  caller: Address;
  amount: bigint;
}

/** LeaseFactory event argument types */
export interface LeaseCreatedArgs {
  leaseId: Hash;
  escrow: Address;
  landlord: Address;
  tenant: Address;
  serviceProfileId: Hash;
  termsHash: Hash;
  hardEndAt: bigint;
}

export interface NewLeasesPausedArgs {
  owner: Address;
}

/** Discriminated union of all Escrow event args keyed by event name */
export type EscrowEventArgs =
  | { name: 'CaseEscalated'; args: CaseEscalatedArgs }
  | { name: 'CaseOpened'; args: CaseOpenedArgs }
  | { name: 'CheckoutCaseOpened'; args: CheckoutCaseOpenedArgs }
  | { name: 'CheckoutCaseResolved'; args: CheckoutCaseResolvedArgs }
  | { name: 'CheckoutRequested'; args: CheckoutRequestedArgs }
  | { name: 'CheckoutResponded'; args: CheckoutRespondedArgs }
  | { name: 'ClaimResponded'; args: ClaimRespondedArgs }
  | { name: 'ClaimWaived'; args: ClaimWaivedArgs }
  | { name: 'ClaimsClosed'; args: ClaimsClosedArgs }
  | { name: 'ClaimsOpened'; args: ClaimsOpenedArgs }
  | { name: 'ClaimsSubmitted'; args: ClaimsSubmittedArgs }
  | { name: 'CreditAllocated'; args: CreditAllocatedArgs }
  | { name: 'DecisionFinalized'; args: DecisionFinalizedArgs }
  | { name: 'DecisionProposed'; args: DecisionProposedArgs }
  | { name: 'EscrowExpired'; args: EscrowExpiredArgs }
  | { name: 'EvidenceAcknowledged'; args: EvidenceAcknowledgedArgs }
  | { name: 'EvidenceCommitted'; args: EvidenceCommittedArgs }
  | { name: 'Funded'; args: FundedArgs }
  | { name: 'LeaseCancelled'; args: LeaseCancelledArgs }
  | { name: 'ServiceTimedOut'; args: ServiceTimedOutArgs }
  | { name: 'SettlementConfirmed'; args: SettlementConfirmedArgs }
  | { name: 'SettlementProposed'; args: SettlementProposedArgs }
  | { name: 'TermsAccepted'; args: TermsAcceptedArgs }
  | { name: 'TimeoutAllocated'; args: TimeoutAllocatedArgs }
  | { name: 'Withdrawn'; args: WithdrawnArgs };
