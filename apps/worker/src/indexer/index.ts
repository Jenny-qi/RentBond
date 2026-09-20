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

/** Unique idempotency key for a chain log event */
export interface EventKey {
  chainId: number;
  txHash: Hash;
  logIndex: number;
}

/** Stored event record with checkpoint */
export interface StoredEvent extends EventKey {
  blockHash: Hash;
  blockNumber: number;
  eventName: string;
  args: Record<string, unknown>;
  /** Whether this event has been processed into projection */
  processed: boolean;
  processedAt?: number;
}

/**
 * Indexer state — tracks the last synced block to support resume.
 */
export interface IndexerState {
  chainId: number;
  contractAddress: Address;
  lastSyncedBlock: number;
  lastSyncedBlockHash: Hash;
}

export interface IndexerConfig {
  rpcUrl: string;
  rpcFallbackUrl?: string;
  chainId: number;
  contractAddress: Address;
  deploymentBlock: number;
  /** ABI — must be generated from contract, never hand-written */
  abi: unknown[];
  /** Persist queue (path to JSON file or DB connection) */
  persistencePath: string;
}

/**
 * Build a deterministic idempotency key for a log event.
 */
export function eventKey(
  chainId: number,
  txHash: Hash,
  logIndex: number
): string {
  return `${chainId}:${txHash}:${logIndex}`;
}
