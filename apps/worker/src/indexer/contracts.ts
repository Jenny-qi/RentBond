/**
 * Contract function caller re-exports and Factory caller.
 *
 * Real EscrowCaller implementation lives in escrow-caller.ts.
 * FactoryCaller is also implemented here (LeaseFactory.paused).
 *
 * E owns; B reviews function signatures and access control.
 */

import type { Address } from '@rentbond/shared';

// Re-export real EscrowCaller from escrow-caller.ts
export type { EscrowCaller, TxResult } from './escrow-caller.js';
export { buildEscrowCaller, ESCROW_PHASE, verifyLeasePhase } from './escrow-caller.js';

/** Factory caller interface */
export interface FactoryCaller {
  /** Check if new leases are paused */
  isPaused(factory: Address): Promise<boolean>;
}

/** Build a FactoryCaller with real viem RPC calls */
export async function buildFactoryCaller(rpcUrl: string): Promise<FactoryCaller> {
  const { createPublicClient, http } = await import('viem');
  const factoryAbi = await import('../../../../deployments/abi/LeaseFactory.json');

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  async function isPaused(factory: Address): Promise<boolean> {
    return publicClient.readContract({
      address: factory,
      abi: factoryAbi.default,
      functionName: 'paused',
      args: [],
    }) as Promise<boolean>;
  }

  return { isPaused };
}
