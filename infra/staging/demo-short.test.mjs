import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { prepareDemoShort, writeDemoShort, DEMO_SHORT_TIMING } from './demo-short.mjs';
import { computeTermsCommitment, canonicalJson } from '../../packages/shared/src/commitments/index.ts';
import { liveWorkerFixture } from '../../apps/web/src/server/tests/worker-fixture.mjs';
import { checkedProfile } from '../../apps/web/src/server/leases.ts';
import { registryAbi } from '../../apps/web/src/server/chain.ts';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { decodeFunctionData } = require('viem');
const addr = n => '0x' + String(n).padStart(40, '0');
const sample = { chainId: 10143, registryAddress: addr(1), primaryResolver: addr(2),
  fallbackResolver: addr(3), token: addr(4), maxDeposit: '1000000000',
  maxLeaseEnd: '2000000000', acceptUntil: '1999999999',
  serviceText: 'Fictional service terms used exclusively in automated local tests.' };

test('DEMO_SHORT matches the existing Solidity script and preserves private commitment boundaries', () => {
  const script = execFileSync('git', ['show', 'HEAD:contracts/script/CreateDemoShortProfile.s.sol'], { encoding: 'utf8' });
  const matches = [...script.matchAll(/(\w+): (\d+) minutes/g)];
  assert.equal(matches.length, 9);
  assert.deepEqual(Object.fromEntries(matches.map(([, key, minutes]) => [key, String(Number(minutes) * 60)])), DEMO_SHORT_TIMING);
  const bundle = prepareDemoShort(sample, { now: 1900000000 });
  assert.equal(bundle.privateDraft.reviewed, false);
  assert.equal(bundle.publicDraft.status, 'draft-not-deployed');
  assert.equal(bundle.publicDraft.hardEndOffsetSeconds, ['claim', 'response', 'evidence', 'primary', 'challenge', 'fallbackResolver', 'exitNotice']
    .reduce((sum, field) => sum + Number(bundle.publicDraft.profile.timing[field]), 0));
  assert.equal(bundle.publicDraft.checkoutRetrySeconds, 86400);
  assert.match(execFileSync('git', ['show', 'HEAD:contracts/src/RentBondRules.sol'], { encoding: 'utf8' }), /CHECKOUT_RETRY_DELAY = 1 days/);
  assert.equal(bundle.publicDraft.profile.serviceTermsHash,
    computeTermsCommitment(canonicalJson(bundle.privateDraft.manifest), bundle.privateDraft.salt));
  assert.equal(JSON.stringify(bundle.publicDraft).includes(bundle.privateDraft.salt), false);
  assert.equal(JSON.stringify(bundle.publicDraft).includes(sample.serviceText), false);
  const changed = prepareDemoShort({ ...sample, serviceText: sample.serviceText + ' changed' }, { now: 1900000000, salt: bundle.privateDraft.salt });
  assert.notEqual(changed.publicDraft.profile.profileId, bundle.publicDraft.profile.profileId);
});

test('rejects incomplete examples, wrong networks/roles, expired dates and invalid money', () => {
  for (const patch of [{ chainId: 143 }, { registryAddress: null }, { primaryResolver: addr(0) },
    { fallbackResolver: addr(2) }, { maxDeposit: '999999' }, { maxDeposit: '10000000001' },
    { maxDeposit: '1000001' }, { maxDeposit: 1000000 }, { acceptUntil: '1' },
    { maxLeaseEnd: '1999999998' }, { maxLeaseEnd: '9007199254740992' }, { serviceText: null }])
    assert.throws(() => prepareDemoShort({ ...sample, ...patch }, { now: 1900000000 }));
});

test('writes restrictive private files exclusively and cannot overwrite existing output', async t => {
  const root = await mkdtemp(join(tmpdir(), 'rentbond-demo-short-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'private'));
  const directory = join(root, 'private', 'new-demo');
  await assert.rejects(writeDemoShort(sample, join(root, 'public')));
  const summary = await writeDemoShort(sample, directory);
  assert.equal(summary.reviewed, false);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  const before = await readFile(join(directory, 'service.draft.json'), 'utf8');
  for (const name of ['service.draft.json', 'unsigned-transactions.json', 'deployment.env'])
    assert.equal((await stat(join(directory, name))).mode & 0o777, 0o600);
  await assert.rejects(writeDemoShort(sample, directory), { code: 'EEXIST' });
  assert.equal(await readFile(join(directory, 'service.draft.json'), 'utf8'), before);
});

test('unsigned calldata deploys on local EVM and backend rejects service until both R/F accept', async t => {
  const f = await liveWorkerFixture(t, { setupOnly: true });
  const now = Number((await f.publicClient.getBlock()).timestamp);
  const bundle = prepareDemoShort({ ...sample, registryAddress: f.registry,
    primaryResolver: f.r.account.address, fallbackResolver: f.fallback.account.address,
    token: f.token, maxLeaseEnd: String(now + 7200), acceptUntil: String(now + 3600) });
  const { profile } = bundle.publicDraft;
  assert.equal(await f.publicClient.readContract({ address: f.registry, abi: registryAbi,
    functionName: 'computeTimingProfileId', args: [profile.timing, profile.timeoutPolicy] }), profile.timingProfileId);
  assert.equal(await f.publicClient.readContract({ address: f.registry, abi: registryAbi,
    functionName: 'computeProfileId', args: [profile] }), profile.profileId);
  const send = async (wallet, tx) => {
    assert.equal(tx.to, f.registry.toLowerCase());
    const decoded = decodeFunctionData({ abi: registryAbi, data: tx.data });
    assert.equal(decoded.functionName, tx.functionName);
    const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: 0n });
    assert.equal((await f.publicClient.waitForTransactionReceipt({ hash })).status, 'success');
  };
  await send(f.wallets[0], bundle.publicDraft.transactions[0]);
  const key = f.registry.toLowerCase() + ':' + profile.profileId;
  const { privateDraft } = bundle;
  const insert = async (id, manifest, reviewed) => f.app.db.query('INSERT INTO service_profiles(id,chain_id,registry_address,profile_id,manifest,salt,commitment,reviewed,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, 10143, f.registry.toLowerCase(), profile.profileId, JSON.stringify(manifest), privateDraft.salt, profile.serviceTermsHash, reviewed, f.app.now()]);
  const context = { app: f.app, sql: f.app.db };
  await assert.rejects(checkedProfile(context, key), /reviewed test service/);
  // Test-only reviewed import; the generator still emits reviewed:false.
  await insert(key, privateDraft.manifest, true);
  await assert.rejects(checkedProfile(context, key), /not eligible/);
  await send(f.rw, bundle.publicDraft.transactions[1]);
  await assert.rejects(checkedProfile(context, key), /not eligible/);
  await send(f.fw, bundle.publicDraft.transactions[2]);
  const checked = await checkedProfile(context, key);
  assert.equal(checked.profile.profileId, profile.profileId);
  assert.deepEqual(checked.profile.timing, DEMO_SHORT_TIMING);
  // The existing immutable profile cannot be silently changed.
  const tampered = { ...privateDraft.manifest, parameters: { ...privateDraft.manifest.parameters, maxDeposit: '2000000000' } };
  await assert.rejects(f.app.db.query('UPDATE service_profiles SET manifest=$1 WHERE id=$2', [JSON.stringify(tampered), key]), /immutable record/);
});
