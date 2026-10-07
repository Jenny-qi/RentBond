import test from 'node:test';
import assert from 'node:assert/strict';
import { openPasskey } from '../../features/live/wallet.ts';
import { fixture, client, draft, upload, png } from './helpers.mjs';

// Inject only WebAuthn output. Mera derivation, signatures, SIWE, DB and ACL
// execute normally; this is not a physical authenticator compatibility test.
const device = seed => ({
  createCredential: async () => ({ credentialId: new Uint8Array([seed]), prfEnabled: true, prfOutput: new Uint8Array(32).fill(seed) }),
  getCredential: async () => ({ credentialId: new Uint8Array([seed]), prfOutput: new Uint8Array(32).fill(seed) }),
});

test('cache-free Mera recovery restores SIWE lease/material access; another passkey gains no roles', async t => {
  const { app } = await fixture(t);
  const signal = new AbortController().signal;
  const original = await openPasskey('create', '', signal, device(12), 'localhost');
  t.after(() => original.end());
  const landlord = client(app), tenant = client(app, original.account);
  await landlord.login(); await tenant.login();
  const leaseId = await draft(app, landlord, tenant);
  const file = await upload(app, landlord, leaseId);
  const access = `/api/documents/${file.documentId}/access?version=${file.version}`;
  const oldGrant = await tenant.request(access);
  assert.equal(oldGrant.status, 200);
  await tenant.request('/api/auth/logout', { method: 'POST', json: {} });
  tenant.jar.clear(); original.end();

  const restored = await openPasskey('restore', '', signal, device(12), 'localhost');
  t.after(() => restored.end());
  const returning = client(app, restored.account);
  assert.equal((await returning.request(`/api/leases/${leaseId}`)).status, 401);
  await returning.login();
  assert.equal(returning.wallet, tenant.wallet);
  assert.equal((await returning.request('/api/leases')).data.items[0].id, leaseId);
  assert.equal((await returning.request(`/api/leases/${leaseId}`)).status, 200);
  assert.equal((await returning.request(oldGrant.data.url)).status, 403);
  const grant = await returning.request(access);
  assert.equal(grant.status, 200);
  assert.deepEqual((await returning.request(grant.data.url)).data, png());
  assert.equal((await returning.request('/api/exports', { method: 'POST', json: { leaseId } })).status, 202);

  const different = await openPasskey('restore', '', signal, device(13), 'localhost');
  t.after(() => different.end());
  const stranger = client(app, different.account); await stranger.login();
  assert.notEqual(stranger.wallet, tenant.wallet);
  assert.deepEqual((await stranger.request('/api/leases')).data.items, []);
  for (const path of [`/api/leases/${leaseId}`, access, grant.data.url]) {
    assert.equal((await stranger.request(path)).status, 403);
  }
  assert.equal((await stranger.request('/api/exports', { method: 'POST', json: { leaseId } })).status, 403);
  assert.equal((await returning.request(`/api/leases/${leaseId}`)).status, 200);
});
