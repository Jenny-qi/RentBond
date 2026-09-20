/**
 * Chain event indexer — reads and replays events from the DepositEscrow contract.
 *
 * Reads from: deployment block, RPC URL, ABI, persistent queue.
 * Produces: idempotent event projections, public progress records, retry state.
 *
 * Idempotency key: chainId + txHash + logIndex.
 * Also stores blockHash and sync checkpoint for rollback on re-orgs.
 *
 * E owns; B/D collaborate on event schema and projection mapping.
 */

import type { Address, Hash } from '@rentbond/shared';

/** On-chain events emitted by DepositEscrow */
export const CONTRACT_EVENTS = {
  FUNDED: 'Funded',
  CHECKOUT_REQUESTED: 'CheckoutRequested',
  CHECKOUT_NEGATED: 'CheckoutNegated',
  CLAIMS_SUBMITTED: 'ClaimsSubmitted',
  CLAIMS_WINDOW_CLOSED: 'ClaimsWindowClosed',
  CLAIM_RESPONSE_UPDATED: 'ClaimResponseUpdated',
  CLAIM_WITHDRAWN: 'ClaimWithdrawn',
  PRIMARY_DECISION_PROPOSED: 'PrimaryDecisionProposed',
  PRIMARY_DECISION_CHALLENGED: 'PrimaryDecisionChallenged',
  FALLBACK_DECISION_PROPOSED: 'FallbackDecisionProposed',
  FALLBACK_DECISION_PROPOSED_TIMEOUT: 'FallbackDecisionProposedTimeout',
  ESCROW_EXPIRED: 'EscrowExpired',
  WITHDRAWN: 'Withdrawn',
  SERVICE_AUTHORIZATION: 'ServiceAuthorization',
} as const;
export type ContractEventName =
  (typeof CONTRACT_EVENTS)[keyof typeof CONTRACT_EVENTS];

/** Unique idempotency key for a chain log event */
export interface EventKey {
  chainId: number;
  txHash: Hash;
  logIndex: number;
}

/** Stored event record with checkpoint */
export interface StoredEvent extends EventKey {
  blockHash: Hash;
  blockNumber: bigint;
  eventName: ContractEventName;
  args: Record<string, unknown>;
  /** Whether this event has been processed into projection */
  processed: boolean;
  processedAt?: number;
}

/**
 * Indexer state — tracks the last synced block to support resume.
 * Persisted after every successful sync batch.
 */
export interface IndexerState {
  chainId: number;
  contractAddress: Address;
  lastSyncedBlock: bigint;
  lastSyncedBlockHash: Hash;
}

export interface IndexerConfig {
  rpcUrl: string;
  rpcFallbackUrl?: string;
  chainId: number;
  contractAddress: Address;
  deploymentBlock: bigint;
  /** ABI — must be generated from contract, never hand-written */
  abi: unknown[];
  /** Path to JSON file or DB connection string for persistence */
  persistencePath: string;
}

/**
 * Build a deterministic idempotency key for a log event.
 * Format: "{chainId}:{txHash}:{logIndex}"
 */
export function eventKey(
  chainId: number,
  txHash: Hash,
  logIndex: number
): string {
  return `${chainId}:${txHash}:${logIndex}`;
}

/**
 * Parse an idempotency key back into its components.
 */
export function parseEventKey(key: string): EventKey {
  const [chainId, txHash, logIndex] = key.split(':');
  return {
    chainId: Number(chainId),
    txHash: txHash as Hash,
    logIndex: Number(logIndex),
  };
}
