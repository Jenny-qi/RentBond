/**
 * Chain event indexer — reads and replays events from DepositEscrow and Factory contracts.
 *
 * The indexer operates in two phases:
 * 1. Factory phase: listen for LeaseCreated events to discover new escrow contracts
 * 2. Escrow phase: listen for state-transition events on each DepositEscrow contract
 *
 * Reads from: deployment block, RPC URL, ABI, persistent queue.
 * Produces: idempotent event projections, public progress records, retry state.
 *
 * Idempotency key: chainId + contractAddress + txHash + logIndex.
 * Also stores blockHash and sync checkpoint for rollback on re-orgs.
 *
 * E owns; B/D collaborate on event schema and projection mapping.
 */

import type { Address, Hash } from '@rentbond/shared';

/** On-chain events emitted by DepositEscrow */
export const ESCROW_EVENTS = {
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
export type EscrowEventName = (typeof ESCROW_EVENTS)[keyof typeof ESCROW_EVENTS];

/** On-chain events emitted by LeaseFactory */
export const FACTORY_EVENTS = {
  LEASE_CREATED: 'LeaseCreated',
} as const;
export type FactoryEventName = (typeof FACTORY_EVENTS)[keyof typeof FACTORY_EVENTS];

/** All contract event names (union of Factory + Escrow) */
export type ContractEventName = EscrowEventName | FactoryEventName;

/** Unique idempotency key for a chain log event */
export interface EventKey {
  chainId: number;
  /** Contract that emitted the event */
  contractAddress: Address;
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
 * Indexer state — tracks the last synced block for each tracked contract.
 * Persisted after every successful sync batch.
 *
 * For the Factory contract this is the last LeaseCreated block checked.
 * For each DepositEscrow contract this is the last escrow event block checked.
 */
export interface IndexerState {
  chainId: number;
  factoryAddress: Address;
  /** contractAddress → last synced block */
  escrowPositions: Record<Address, { lastBlock: bigint; lastBlockHash: Hash }>;
  /** Last block we checked on the factory */
  factoryLastBlock: bigint;
  factoryLastBlockHash: Hash;
}

export interface IndexerConfig {
  rpcUrl: string;
  rpcFallbackUrl?: string;
  chainId: number;
  /** LeaseFactory contract address — used to discover new escrows */
  factoryAddress: Address;
  /** Deployment block of the factory — indexer starts from here */
  factoryDeploymentBlock: bigint;
  /** ABI — must be generated from contract, never hand-written */
  factoryAbi: unknown[];
  escrowAbi: unknown[];
  /** Path to JSON file or DB connection string for persistence */
  persistencePath: string;
  /** How many blocks to fetch per polling batch */
  batchSize: number;
  /** Polling interval in ms */
  pollIntervalMs: number;
}

/**
 * Build a deterministic idempotency key for a log event.
 * Format: "{chainId}:{contractAddress}:{txHash}:{logIndex}"
 */
export function eventKey(
  chainId: number,
  contractAddress: Address,
  txHash: Hash,
  logIndex: number
): string {
  return `${chainId}:${contractAddress}:${txHash}:${logIndex}`;
}

/**
 * Parse an idempotency key back into its components.
 */
export function parseEventKey(key: string): EventKey {
  const [chainId, contractAddress, txHash, logIndex] = key.split(':');
  return {
    chainId: Number(chainId),
    contractAddress: contractAddress as Address,
    txHash: txHash as Hash,
    logIndex: Number(logIndex),
  };
}

/**
 * Determine whether an event is a Factory event or an Escrow event.
 */
export function isFactoryEvent(name: ContractEventName): name is FactoryEventName {
  return name === FACTORY_EVENTS.LEASE_CREATED;
}
