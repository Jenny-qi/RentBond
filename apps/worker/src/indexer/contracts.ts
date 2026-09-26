/**
 * Contract function caller stubs — Worker actions on DepositEscrow.
 *
 * These are thin wrappers around viem RPC calls. All functions are idempotent:
 * they check on-chain state before acting, so re-calling after a partial failure
 * is safe.
 *
 * E owns; B reviews function signatures and access control.
 *
 * TODO RB-12: replace TODO comments with real viem/ethers RPC calls.
 * TODO RB-12: implement with @rentbond/shared verifyAllocationConservation after each state change.
 */

import type { Address, Hash } from '@rentbond/shared';

/** Result of a Worker-initiated on-chain transaction */
export interface TxResult {
  txHash?: Hash;
  blockNumber?: bigint;
  gasUsed?: bigint;
  revertReason?: string;
  success: boolean;
}

/** Escrow caller interface — all Worker actions on a single DepositEscrow */
export interface EscrowCaller {
  closeClaims(escrow: Address): Promise<TxResult>;
  finalizePrimary(escrow: Address, caseId: bigint): Promise<TxResult>;
  finalizeFallback(escrow: Address, caseId: bigint): Promise<TxResult>;
  finalizeTimeout(escrow: Address, caseId: bigint): Promise<TxResult>;
  expireEscrow(escrow: Address): Promise<TxResult>;
  withdraw(escrow: Address): Promise<TxResult>;
  withdrawFor(escrow: Address, beneficiary: Address): Promise<TxResult>;
}

/** Factory caller interface */
export interface FactoryCaller {
  /** Check if new leases are paused */
  isPaused(factory: Address): Promise<boolean>;
}

/** Build an EscrowCaller with real viem RPC calls */
export function buildEscrowCaller(
  rpcUrl: string,
  signer: { address: Address }
): EscrowCaller {
  // TODO RB-12: implement with viem
  // const { createPublicClient, createWalletClient, http } = await import('viem');
  // const publicClient = createPublicClient({ transport: http(rpcUrl), chain: monadTestnet });
  // const walletClient = createWalletClient({ transport: http(rpcUrl), account: signer.address });

  async function notImplemented(func: string, escrow: Address, ...args: unknown[]): Promise<TxResult> {
    console.warn(`[WORKER] ${func}(${escrow}${args.length ? ', ' + args.join(', ') : ''}) not implemented — RB-12 required`);
    throw new Error(`${func} not implemented — RB-12 required`);
  }

  return {
    closeClaims:        (escrow) => notImplemented('closeClaims', escrow),
    finalizePrimary:    (escrow, caseId) => notImplemented('finalizePrimary', escrow, caseId),
    finalizeFallback:   (escrow, caseId) => notImplemented('finalizeFallback', escrow, caseId),
    finalizeTimeout:    (escrow, caseId) => notImplemented('finalizeTimeout', escrow, caseId),
    expireEscrow:      (escrow) => notImplemented('expireEscrow', escrow),
    withdraw:          (escrow) => notImplemented('withdraw', escrow),
    withdrawFor:       (escrow, beneficiary) => notImplemented('withdrawFor', escrow, beneficiary),
  };
}

/** Build a FactoryCaller with real viem RPC calls */
export function buildFactoryCaller(rpcUrl: string): FactoryCaller {
  async function isPaused(factory: Address): Promise<boolean> {
    // TODO RB-12: call LeaseFactory.paused()
    console.warn(`[WORKER] isPaused(${factory}) not implemented — RB-12 required`);
    return false;
  }
  return { isPaused };
}
