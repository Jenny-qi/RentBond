import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, type WebAuthnClient } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { MERA_DERIVATION, assertSameAddress } from '../account/mera.ts';
import type { Wallet } from './client.ts';

export async function openPasskey(mode: 'create' | 'restore', expectedAddress: string, signal: AbortSignal, webAuthnClient?: WebAuthnClient, rpId = window.location.hostname): Promise<Wallet> {
  const expected = expectedAddress.trim();
  if (!rpId || /[/:\s]/.test(rpId)) throw new Error('Invalid passkey domain.');
  if (mode === 'restore' && expected) assertSameAddress(expected, expected);
  signal.throwIfAborted();
  const prfSalt = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(MERA_DERIVATION)));
  signal.throwIfAborted();
  const result = mode === 'create'
    ? await createPasskeyWithPrfOutput({ rp: { id: rpId, name: 'RentBond' }, user: { name: 'RentBond account', displayName: 'RentBond test account' }, prfSalt, timeout: 60000, webAuthnClient })
    : await getPasskeyPrfOutput({ rpId, prfSalt, timeout: 60000, webAuthnClient });
  let signing: ReturnType<typeof createSecp256k1SigningSession> | undefined;
  try {
    signal.throwIfAborted();
    signing = createSecp256k1SigningSession({ privateKey: result.prfOutput });
    const account = toViemAccount(signing);
    // Discoverable passkeys recover the account without browser storage. An
    // explicitly supplied address is an extra check, never an authorization.
    if (mode === 'restore' && expected) assertSameAddress(expected, account.address);
    const session = signing;
    return { address: account.address, account, end: () => session.end() };
  } catch (error) { signing?.end(); throw error; }
  finally { result.prfOutput.fill(0); }
}
