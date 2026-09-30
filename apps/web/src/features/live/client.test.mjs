import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, verifyMessage } from 'viem';
import { actionData, actionAbi, assertAccounting, canConfirmProposal, checkWallet, checkedConfig, api, clearRequests } from './client.ts';
import { openPasskey } from './wallet.ts';
const addr = '0x' + '11'.repeat(20), hash = '0x' + 'ab'.repeat(32);
test('live ABI encodes precise acknowledgement, funding and immutable proposal ID', () => {
  for (const [functionName, args] of [['acknowledgeEvidence', [addr, 2n, hash, hash, false]], ['fund', [1000000000n]], ['confirmSettlement', [7n]], ['recordEvidence', [hash, 3n, hash]]]) {
    const action = { address: addr, functionName, args };
    const decoded = decodeFunctionData({ abi: actionAbi(action), data: actionData(action) });
    assert.equal(decoded.functionName, functionName); assert.deepEqual(decoded.args, args);
  }
});
test('live accounting rejects lost money; stale, self and expired proposals cannot be confirmed', () => {
  const a = { fundedAmount: '1000000000', unallocated: '200000000', tenantCredit: '700000000', landlordCredit: '100000000', tenantWithdrawn: '0', landlordWithdrawn: '0', revision: '5' };
  assertAccounting(a); assert.throws(() => assertAccounting({ ...a, tenantCredit: '0' }));
  const p = { proposalId: '7', proposer: '0x' + '22'.repeat(20), snapshotRevision: '5', tenantShare: '150000000', landlordShare: '50000000', validUntil: '200' };
  assert.equal(canConfirmProposal(p, a, 199, addr, 500), true);
  assert.equal(canConfirmProposal(p, a, 200, addr, 500), false);
  assert.equal(canConfirmProposal(p, { ...a, revision: '6' }, 199, addr, 500), false);
  assert.equal(canConfirmProposal(p, a, 199, p.proposer, 500), false);
  assert.equal(canConfirmProposal(p, a, 199, addr, 500, 199), false);
});
test('real signing adapter restores only the original address and cancelled sessions never escape', async () => {
  const output = () => new Uint8Array(32).fill(1);
  const device = { createCredential: async () => ({ credentialId: new Uint8Array([1]), prfEnabled: true, prfOutput: output() }), getCredential: async () => ({ credentialId: new Uint8Array([1]), prfOutput: output() }) };
  const abort = new AbortController();
  const first = await openPasskey('create', '', abort.signal, device, 'localhost');
  const restored = await openPasskey('restore', first.address, abort.signal, device, 'localhost');
  const signature = await restored.account.signMessage({ message: 'Local adapter test only' });
  assert.equal(await verifyMessage({ address: first.address, message: 'Local adapter test only', signature }), true);
  first.end(); restored.end();
  await assert.rejects(restored.account.signMessage({ message: 'ended' }));
  await assert.rejects(openPasskey('restore', addr, abort.signal, device, 'localhost'), /different address/);
  const cancelled = new AbortController();
  await assert.rejects(openPasskey('create', '', cancelled.signal, { ...device, createCredential: async () => { cancelled.abort(); return device.createCredential(); } }, 'localhost'), { name: 'AbortError' });
});
test('missing or unsafe testnet configuration fails closed', () => {
  assert.throws(() => checkedConfig({ mode: 'testnet', chainId: 1, rpcUrl: 'https://example.invalid', factory: addr, confirmations: 1 }));
  assert.throws(() => checkedConfig({ mode: 'testnet', chainId: 10143, rpcUrl: 'http://example.invalid', factory: addr, confirmations: 1 }));
  assert.throws(() => checkedConfig({ mode: 'local', chainId: 31337, rpcUrl: 'http://127.0.0.1', factory: addr, confirmations: 0 }));
});
test('ambiguous API retries reuse the same idempotency key; success clears it', async t => {
  clearRequests(); let attempt = 0; const keys = [];
  t.mock.method(globalThis, 'fetch', async (_, options) => { keys.push(options.headers['Idempotency-Key']); if (++attempt === 1) throw new Error('connection lost'); return new Response('{}', { status: 200 }); });
  await assert.rejects(api('/api/leases/drafts', { title: 'example' }));
  await api('/api/leases/drafts', { title: 'example' }); await api('/api/leases/drafts', { title: 'example' });
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]); clearRequests();
});
