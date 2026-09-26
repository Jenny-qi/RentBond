/**
 * Re-org detection — handles chain reorganizations safely.
 *
 * When a blockHash changes for a previously-seen block, the chain has re-orged.
 * All events from the affected block onwards must be reprojected.
 *
 * E owns; B reviews re-org detection logic.
 */

import type { Address, Hash } from '@rentbond/shared';

export interface ChainPosition {
  blockNumber: bigint;
  blockHash: Hash;
}

/**
 * Detect whether a new block header conflicts with a previously recorded position.
 *
 * Returns true if the chain has re-orged:
 * - The stored block hash differs from the canonical block hash at that height.
 *
 * In this case, all events from conflictingBlock onwards must be reprojected.
 *
 * @param stored      Previously recorded block hash at a given height
 * @param canonical  Current canonical block hash at the same height
 * @returns true if re-org detected
 */
export function isReorg(stored: Hash, canonical: Hash): boolean {
  // case-sensitive exact comparison — block hashes are deterministic
  return stored !== canonical;
}

/**
 * Filter an ordered list of positions to only those unaffected by a re-org.
 *
 * Given a list of positions (newest last) and a re-org cutoff, returns
 * only the positions that are still valid.
 *
 * @param positions  Ordered from oldest to newest (lastBlockHash of each contract sync)
 * @param cutoff     Block number at which the re-org occurred
 * @returns positions that are guaranteed valid (before the re-org point)
 */
export function filterReorgedPositions(
  positions: ChainPosition[],
  cutoff: bigint
): ChainPosition[] {
  return positions.filter(p => p.blockNumber < cutoff);
}

/**
 * Result of a re-org check for an indexer state.
 */
export interface ReorgCheckResult {
  hasReorg: boolean;
  /** The block number at which the first discrepancy was found */
  conflictBlock?: bigint;
  /** All contract addresses whose positions need to be rolled back */
  affectedContracts: Address[];
}

/**
 * Check whether any tracked contract position has a re-org.
 *
 * @param storedPositions  Per-contract last synced positions from IndexerState
 * @param canonicalBlockHash At each block height, the current canonical hash from RPC
 * @returns which contracts need to be reset and from which block
 *
 * TODO RB-12: implement with eth_getBlockByNumber RPC calls
 */
export async function checkReorg(
  storedPositions: Record<Address, { lastBlock: bigint; lastBlockHash: Hash }>,
  _canonicalBlockHash: (blockNumber: bigint) => Promise<Hash>
): Promise<ReorgCheckResult> {
  for (const [contract, pos] of Object.entries(storedPositions)) {
    const canonical = await _canonicalBlockHash(pos.lastBlock);
    if (isReorg(pos.lastBlockHash, canonical)) {
      return {
        hasReorg: true,
        conflictBlock: pos.lastBlock,
        affectedContracts: [contract as Address],
      };
    }
  }
  return { hasReorg: false, affectedContracts: [] };
}
