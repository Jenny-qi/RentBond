import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, getEvmAddress, isMeraError, type WebAuthnClient } from '@category-labs/mera';

// Frozen derivation identity. Changing it creates a different account, not recovery.
export const MERA_DERIVATION = 'rentbond.mera.evm.v1';
export interface MeraAccountRecord {
  derivation: typeof MERA_DERIVATION;
  rpId: string;
  address: `0x${string}`;
  credentialId: string;
}
export function assertSameAddress(expected: string, actual: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(expected.trim())) throw new Error('Enter the full original account address.');
  if (expected.trim().toLowerCase() !== actual.toLowerCase()) throw new Error('This passkey derives a different address. Recovery failed; the original account was not replaced.');
}
async function salt() {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(MERA_DERIVATION)));
}
// Outputs public metadata only. End the session and erase PRF bytes even on mismatch/cancel.
export async function inspectMeraAccount(input: {
  mode: 'create' | 'restore'; rpId: string; expectedAddress?: string;
  signal?: AbortSignal; webAuthnClient?: WebAuthnClient;
}): Promise<MeraAccountRecord> {
  if (!input.rpId || /[/:\s]/.test(input.rpId)) throw new Error('Invalid passkey domain.');
  if (input.mode === 'restore' && !/^0x[0-9a-fA-F]{40}$/.test(input.expectedAddress?.trim() ?? '')) throw new Error('The original account address is required for recovery.');
  input.signal?.throwIfAborted();
  const prfSalt = await salt();
  input.signal?.throwIfAborted();
  const result = input.mode === 'create'
    ? await createPasskeyWithPrfOutput({ rp: { id: input.rpId, name: 'RentBond account trial' }, user: { name: 'RentBond test account', displayName: 'RentBond test account' }, prfSalt, timeout: 60000, webAuthnClient: input.webAuthnClient })
    : await getPasskeyPrfOutput({ rpId: input.rpId, prfSalt, timeout: 60000, webAuthnClient: input.webAuthnClient });
  let session: ReturnType<typeof createSecp256k1SigningSession> | undefined;
  try {
    input.signal?.throwIfAborted();
    session = createSecp256k1SigningSession({ privateKey: result.prfOutput });
    const address = getEvmAddress(session.publicKey);
    if (input.mode === 'restore') assertSameAddress(input.expectedAddress!, address);
    return { derivation: MERA_DERIVATION, rpId: input.rpId, address, credentialId: result.credentialId };
  } finally {
    session?.end();
    result.prfOutput.fill(0);
  }
}
export function meraErrorMessage(error: unknown): string {
  if (isMeraError(error)) {
    if (error.code === 'PRF_UNAVAILABLE') return 'This device or passkey does not support PRF. The signing account cannot be recovered here; no replacement address will be created.';
    if (error.code === 'PASSKEY_OPERATION_FAILED') return 'Passkey operation cancelled, timed out or unavailable. Account verification was not completed.';
    return 'Account verification failed. No signing session was created. Keep the original passkey and check device compatibility.';
  }
  if (error instanceof DOMException && error.name === 'AbortError') return 'Account verification cancelled.';
  let cause: unknown = error;
  for (let i = 0; cause && i < 8; i++) {
    const current = cause as { code?: number; name?: string; data?: { errorName?: string }; cause?: unknown };
    if (current.code === 4001 || current.name === 'UserRejectedRequestError') return 'Signature request cancelled. Nothing further was submitted.';
    const contractErrors: Record<string, string> = {
      DeadlineNotReached: 'This deadline has not been reached. Refresh the on-chain state.',
      DeadlinePassed: 'The submission window has closed.',
      Unauthorized: 'This account is not authorized for this action.',
      InvalidState: 'The lease state has changed. Refresh before trying again.',
      StaleProposal: 'This proposal is no longer valid. Review the latest amounts.',
      NothingToWithdraw: 'There is no claimable balance for this account.',
      ServiceNotEligible: 'The selected service is not eligible for new funding.',
    };
    if (current.data?.errorName) return contractErrors[current.data.errorName] ?? `Contract rejected the action: ${current.data.errorName}. Refresh and review the current state.`;
    cause = current.cause;
  }
  if (error instanceof Error && !/[\p{Script=Han}]/u.test(error.message)) {
    if (error.message.includes('\n')) return (error as Error & { shortMessage?: string }).shortMessage ?? 'The operation could not be completed. Check the network and current transaction status before retrying.';
    return error.message;
  }
  return 'The operation could not be completed. The original account was not changed. Check the current transaction status before retrying.';
}
