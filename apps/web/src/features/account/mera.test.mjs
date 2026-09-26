import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectMeraAccount, assertSameAddress, meraErrorMessage } from './mera.ts';
import { MeraError } from '@category-labs/mera';
import { createSecp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { verifyMessage } from 'viem';
// Public test vector, never an account funded by the application.
const output = () => new Uint8Array(32).fill(1);
const client = {
  createCredential: async () => ({ credentialId: new Uint8Array([1, 2, 3]), prfEnabled: true, prfOutput: output() }),
  getCredential: async () => ({ credentialId: new Uint8Array([1, 2, 3]), prfOutput: output() }),
};
test('SDK adapter derives same address from same PRF; only public metadata escapes', async () => {
  const first = await inspectMeraAccount({ mode: 'create', rpId: 'localhost', webAuthnClient: client });
  const restored = await inspectMeraAccount({ mode: 'restore', rpId: 'localhost', expectedAddress: first.address.toLowerCase(), webAuthnClient: client });
  assert.equal(first.address, restored.address);
  assert.deepEqual(Object.keys(first).sort(), ['address', 'credentialId', 'derivation', 'rpId']);
  assert.throws(() => assertSameAddress('0x' + '0'.repeat(40), first.address));
  await assert.rejects(inspectMeraAccount({ mode: 'restore', rpId: 'localhost', expectedAddress: '0x' + '0'.repeat(40), webAuthnClient: client }), /不同地址/);
});
test('cancelled late WebAuthn result is discarded and cannot become a session', async () => {
  const abort = new AbortController();
  await assert.rejects(inspectMeraAccount({ mode: 'create', rpId: 'localhost', signal: abort.signal, webAuthnClient: { ...client, createCredential: async () => { abort.abort(); return client.createCredential(); } } }), { name: 'AbortError' });
});
test('invalid restoration rejected before device prompt and PRF failure stays explicit', async () => {
  let calls = 0;
  await assert.rejects(inspectMeraAccount({ mode: 'restore', rpId: 'localhost', expectedAddress: 'bad', webAuthnClient: { ...client, getCredential: async () => { calls++; return client.getCredential(); } } }));
  assert.equal(calls, 0);
  assert.match(meraErrorMessage(new MeraError('PRF_UNAVAILABLE', 'test')), /不支持 PRF/);
});
test('Mera/viem fixture signature verifies and ended session cannot sign again', async () => {
  const key = output();
  const session = createSecp256k1SigningSession({ privateKey: key });
  key.fill(0);
  const account = toViemAccount(session);
  const message = 'RentBond SDK unit test only. No login, transaction or authority.';
  try {
    const signature = await account.signMessage({ message });
    assert.equal(await verifyMessage({ address: account.address, message, signature }), true);
  } finally { session.end(); }
  await assert.rejects(account.signMessage({ message }), /ended/i);
});
