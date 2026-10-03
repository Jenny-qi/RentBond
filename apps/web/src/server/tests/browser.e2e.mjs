// Test-only browser harness. No production hooks, public RPCs, real users or keys.
// Execute from apps/web so Hardhat resolves its pinned local configuration.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { liveWorkerFixture } from './worker-fixture.mjs';
import { handleApi } from '../api.ts';
import { escrowAbi } from '../chain.ts';
import { syncLease } from '../projections.ts';
import { upload } from './helpers.mjs';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const outputDir = root + 'test-results/e2e-local';
const ids = (process.argv[2] ?? 'E2E-01,E2E-02,E2E-03,E2E-04,E2E-05,E2E-06,E2E-07,E2E-08').split(',');
assert.ok(ids.length && new Set(ids).size === ids.length && ids.every(id => /^E2E-0[1-8]$/.test(id)), 'Known, unique browser scenario IDs required');
const cleanups = [];
let f, proxy, next, browser, origin, nextOrigin, stopped = false;
const evidence = {}, results = [];
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description, timeout = 60000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const result = await check(); if (result) return result; } catch (error) { last = error; }
    await pause(100);
  }
  throw new Error('Timed out: ' + description + (last ? '\n' + last.message : ''));
}
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; }
async function close(server) { if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } }
async function setup() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  f = await liveWorkerFixture({ after: fn => cleanups.push(fn) }, { setupOnly: true });
  proxy = createServer(async (req, res) => {
    try {
      const buffers = []; for await (const chunk of req) buffers.push(chunk);
      const body = Buffer.concat(buffers);
      let response;
      if (req.url.startsWith('/api/')) {
        response = await handleApi(f.app, new Request(origin + req.url, { method: req.method, headers: req.headers,
          ...(!['GET', 'HEAD'].includes(req.method) ? { body } : {}) }));
      } else if (req.url === '/rpc') {
        response = await fetch(f.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      } else {
        response = await fetch(nextOrigin + req.url, { method: req.method, headers: { ...req.headers, host: new URL(origin).host },
          ...(!['GET', 'HEAD'].includes(req.method) ? { body } : {}) });
      }
      const cookies = response.headers.getSetCookie(); if (cookies.length) res.setHeader('set-cookie', cookies);
      res.writeHead(response.status, Object.fromEntries([...response.headers].filter(([name]) => !['content-encoding', 'content-length', 'set-cookie'].includes(name))));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: { message: error.message } })); }
  });
  origin = 'http://127.0.0.1:' + await listen(proxy);
  f.app.config.origin = origin;
  const reserve = createServer(); const port = await listen(reserve); await close(reserve);
  nextOrigin = 'http://127.0.0.1:' + port;
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root + 'apps/web', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_APP_ENV: 'local', NEXT_PUBLIC_CHAIN_ID: '10143',
      NEXT_PUBLIC_RPC_URL: origin + '/rpc', NEXT_PUBLIC_FACTORY_ADDRESS: f.factory,
      NEXT_PUBLIC_APP_URL: origin, CHAIN_CONFIRMATIONS: '1' },
  });
  let serverLog = ''; next.stdout.on('data', d => { serverLog += d; }); next.stderr.on('data', d => { serverLog += d; });
  cleanups.push(async () => { await writeFile(outputDir + '/next.log', serverLog); });
  await until(async () => (await fetch(origin + '/login')).ok, 'Next ready', 120000);
  browser = await chromium.launch({ headless: true, ...(process.env.RENTBOND_CHROMIUM_PATH ? { executablePath: process.env.RENTBOND_CHROMIUM_PATH } : {}) });
}
async function actor(index) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, timezoneId: 'UTC' });
  const state = { index, context, rejectNext: false, hashes: [], attempts: 0 };
  await context.exposeBinding('testWalletRequest', async (_, request) => {
    const wallet = f.wallets[index], address = wallet.account.address;
    if (['eth_requestAccounts', 'eth_accounts'].includes(request.method)) return [address];
    if (request.method === 'eth_chainId') return '0x279f';
    if (request.method === 'personal_sign') return wallet.signMessage({ message: { raw: request.params[0] } });
    if (request.method === 'eth_sendTransaction') {
      state.attempts++;
      if (state.rejectNext) { state.rejectNext = false; return { rejected: true }; }
      const tx = request.params[0]; assert.equal(tx.from.toLowerCase(), address.toLowerCase());
      const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value ?? 0),
        ...(tx.gas ? { gas: BigInt(tx.gas) } : {}) });
      state.hashes.push(hash); return hash;
    }
    return f.publicClient.request(request);
  });
  await context.addInitScript(() => {
    // EIP-1193 wallet substitute only. API, RPC, calldata, signatures and receipts are real local execution.
    window.ethereum = { request: async request => {
      const result = await window.testWalletRequest(request);
      if (result?.rejected) { const error = new Error('User rejected request'); error.code = 4001; throw error; }
      return result;
    }, on: () => {}, removeListener: () => {} };
  });
  state.page = await context.newPage();
  state.page.setDefaultTimeout(60000);
  state.page.on('pageerror', error => { state.errors ??= []; state.errors.push(error.message); });
  return state;
}
async function login(actor, path = '/login') {
  await actor.page.goto(origin + path);
  await actor.page.getByText('Use an external wallet', { exact: true }).click();
  await actor.page.getByRole('button', { name: 'Connect wallet & sign in', exact: true }).click();
  await until(async () => (await actor.page.locator('.live-status').innerText()).includes('Account verified.'), 'SIWE login');
  const cookies = await actor.context.cookies(); assert.ok(cookies.some(c => c.httpOnly && c.name.includes('session')));
}
async function visit(actor, lease, section = '') {
  const path = '/leases/' + lease.id + (section ? '/' + section : '');
  if (new URL(actor.page.url()).pathname === path) await actor.page.getByRole('button', { name: 'Refresh', exact: true }).click();
  else {
    if (section.startsWith('cases/')) await actor.page.getByRole('link', { name: 'Resolver', exact: true }).click();
    else await actor.page.getByRole('link', { name: 'My leases', exact: true }).click();
    await actor.page.locator(`a[href="${section.startsWith('cases/') ? path : '/leases/' + lease.id}"]`).first().click();
    if (section && !section.startsWith('cases/')) await actor.page.locator(`a[href="${path}"]`).first().click();
  }
  await actor.page.getByRole('heading', { name: 'Confirmed on-chain balances', exact: true }).waitFor();
  await until(async () => !await actor.page.getByText('Reading confirmed on-chain state…', { exact: true }).count(), 'confirmed snapshot loaded');
}
async function confirm(actor) {
  const before = actor.hashes.length;
  const dialog = actor.page.getByRole('dialog'); await dialog.waitFor();
  const title = await dialog.getByRole('heading').innerText();
  await dialog.getByRole('button', { name: 'Confirm & request signature', exact: true }).click();
  await until(() => actor.hashes.length > before, 'wallet submitted');
  const hash = actor.hashes.at(-1);
  const receipt = await f.publicClient.waitForTransactionReceipt({ hash }); assert.equal(receipt.status, 'success');
  await until(async () => (await actor.page.locator('.live-status').innerText()).includes(title + ': confirmed on-chain.'), 'confirmed UI for ' + title);
  await until(async () => !await dialog.isVisible(), 'confirmation dialog closed');
  return hash;
}
async function button(actor, name) { await actor.page.getByRole('button', { name, exact: true }).click(); return confirm(actor); }
const date = seconds => new Date(Number(seconds) * 1000).toISOString().slice(0, 16);
async function newLease(l, tenant) {
  const now = Number((await f.publicClient.getBlock()).timestamp); f.f.setNow(now * 1000);
  await l.page.getByRole('link', { name: 'My leases', exact: true }).click();
  await l.page.getByRole('link', { name: 'Create a lease draft', exact: true }).click();
  const form = l.page.locator('form').filter({ has: l.page.getByRole('heading', { name: 'Create a lease draft as landlord', exact: true }) });
  for (const [label, value] of Object.entries({ 'Lease name': 'Fictional browser test lease', 'Deposit (1–10,000 MockUSD, up to 2 decimal places)': '1000',
    'Lease start': date(now), 'Lease end': date(now + 3600), 'Acceptance & funding deadline': date(now + 1800),
    'Full terms (at least 20 characters)': 'Fictional local browser test terms. No real tenancy or cash value.' })) await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByLabel('Test service accepted by both resolvers').selectOption(f.profileKey);
  await form.getByRole('button', { name: 'Save draft', exact: true }).click();
  const link = l.page.getByRole('link', { name: 'View draft & invite tenant', exact: true }); await link.waitFor();
  const href = await link.getAttribute('href'), id = href.split('/').at(-1);
  await link.click();
  await l.page.getByRole('button', { name: 'Create a 24-hour invitation', exact: true }).click();
  const invite = l.page.getByLabel('Private invitation link'); await invite.waitFor();
  await login(tenant, new URL(await invite.inputValue()).pathname);
  await tenant.page.getByRole('button', { name: 'Join with this account', exact: true }).click();
  await tenant.page.getByRole('link', { name: 'View the full draft', exact: true }).waitFor();
  await l.page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await l.page.getByRole('button', { name: 'Freeze draft & review contract creation', exact: true }).click();
  const creationTx = await confirm(l);
  const row = await until(async () => {
    const [row] = await f.app.db.query('SELECT * FROM leases WHERE id=$1', [id]);
    return row?.contract_address ? row : false;
  }, 'confirmed factory transaction attached to API record');
  const lease = { id, address: row.contract_address, creationTx, commitment: row.commitment };
  assert.ok(lease.address); await visit(tenant, lease, 'fund');
  await f.write(f.wallets[0], f.token, f.tokenAbi, 'mint', [f.accounts[2].address, 1000000000n]);
  return lease;
}
async function funded(actors) {
  const lease = await newLease(actors.l, actors.t);
  await button(actors.t, 'Accept the full terms');
  await button(actors.t, 'Approve 1000 MockUSD');
  assert.equal((await f.app.chain.lease(lease.address, true)).accounting.fundedAmount, '0');
  await button(actors.t, 'Confirm deposit of 1000 MockUSD');
  await syncLease(f.app, lease.id);
  assert.equal((await f.app.chain.lease(lease.address, true)).accounting.fundedAmount, '1000000000');
  return lease;
}
async function mineAt(seconds) {
  const now = (await f.publicClient.getBlock()).timestamp;
  await f.publicClient.request({ method: 'evm_setNextBlockTimestamp', params: [Math.max(Number(now) + 1, Number(seconds))] });
  await f.publicClient.request({ method: 'evm_mine', params: [] });
}
async function snapshot(lease) { return f.app.chain.lease(lease.address, true); }
async function screenshot(actor, id, label) {
  const path = outputDir + '/' + id + '-' + label + '.png';
  await actor.page.screenshot({ path, fullPage: true }); return path.slice(root.length);
}
async function balance(actor, label, expected) {
  const cell = actor.page.locator('.live-balances > div').filter({ has: actor.page.getByText(label, { exact: true }) });
  await until(async () => await cell.locator('strong').innerText() === expected + ' MockUSD', 'UI balance ' + label);
}
async function split(actors, lease, earlyCheckout = false) {
  const { l, t } = actors;
  if (earlyCheckout) {
    // Fictional document, injected clean scanner: not a public-upload scan acceptance.
    await f.l.login(); const photo = await upload(f.app, f.l, lease.id, { purpose: 'move-out' });
    await visit(t, lease, 'checkout');
    const form = t.page.locator('form').filter({ has: t.page.getByRole('heading', { name: 'Request early checkout', exact: true }) });
    await form.getByLabel('Actual checkout date', { exact: true }).fill(date((await f.publicClient.getBlock()).timestamp));
    await form.getByLabel('Checkout document ID (copy from the materials list)').fill(photo.documentId);
    await form.getByLabel('Checkout explanation (at least 20 characters)').fill('Fictional early checkout for the local browser scenario.');
    await form.getByRole('button', { name: 'Save & review the checkout request', exact: true }).click(); await confirm(t);
    await syncLease(f.app, lease.id); await visit(l, lease, 'checkout'); await button(l, 'Agree to this checkout');
  } else {
    await mineAt((await snapshot(lease)).terms.leaseEndAt);
    await visit(l, lease, 'settlement'); await button(l, 'Start scheduled settlement');
  }
  await visit(l, lease, 'claims');
  const form = l.page.locator('form').filter({ has: l.page.getByRole('heading', { name: 'One-time deduction list (up to 10 items)', exact: true }) });
  await form.getByRole('button', { name: 'Add an item', exact: true }).click();
  for (const [i, amount] of ['100', '200'].entries()) {
    await form.locator(`[name=amount${i}]`).fill(amount);
    await form.locator(`[name=reason${i}]`).fill('Fictional itemized deduction for automated browser testing.');
    await form.locator(`[name=clause${i}]`).fill('Fictional clause 1');
    await form.locator(`[name=noEvidence${i}]`).fill('No genuine materials are used in this fictional local test.');
  }
  await form.getByRole('button', { name: 'Save list & review all amounts', exact: true }).click(); await confirm(l);
  await syncLease(f.app, lease.id); await visit(t, lease, 'claims');
  for (const [id, accept] of [[1, 'true'], [2, 'false']]) {
    const form = t.page.locator('form').filter({ has: t.page.getByRole('heading', { name: 'Respond to item ' + id, exact: true }) });
    await form.locator('select[name=accept]').selectOption(accept);
    await form.getByLabel('Reason (at least 20 characters)', { exact: true }).fill('Fictional response: accept cleaning, dispute the damage amount.');
    await form.getByRole('button', { name: 'Save & review response', exact: true }).click(); await confirm(t);
  }
  const before = await snapshot(lease);
  assert.equal(before.accounting.tenantCredit, '0'); assert.equal(before.accounting.landlordCredit, '0');
  assert.ok(await t.page.getByRole('heading', { name: 'Estimated split — not yet claimable', exact: true }).isVisible());
  await mineAt(before.schedule.claimDeadline); await visit(l, lease, 'settlement');
  await button(l, 'Close claims & allocate undisputed funds'); await syncLease(f.app, lease.id);
  const live = await snapshot(lease); assert.equal(live.accounting.tenantCredit, '700000000');
  assert.equal(live.accounting.landlordCredit, '100000000'); assert.equal(live.accounting.unallocated, '200000000');
  await balance(l, 'Tenant claimable', '700'); await balance(l, 'Landlord claimable', '100'); await balance(l, 'Unallocated', '200');
  return live;
}
async function withdraw(actor, lease, amount) {
  const address = f.accounts[actor.index].address;
  const before = await f.publicClient.readContract({ address: f.token, abi: f.tokenAbi, functionName: 'balanceOf', args: [address] });
  await visit(actor, lease, 'settlement'); await button(actor, 'Withdraw ' + amount.replaceAll(',', '') + ' MockUSD');
  const after = await f.publicClient.readContract({ address: f.token, abi: f.tokenAbi, functionName: 'balanceOf', args: [address] });
  assert.equal(after - before, BigInt(amount.replaceAll(',', '')) * 1000000n); await syncLease(f.app, lease.id);
}
async function openCase(actors, lease) {
  await mineAt((await snapshot(lease)).schedule.responseDeadline); await visit(actors.l, lease, 'settlement');
  await button(actors.l, 'Open the claims case'); await syncLease(f.app, lease.id);
  return (await f.app.db.query('SELECT * FROM cases WHERE lease_id=$1', [lease.id]))[0];
}
async function run(id, actors) {
  const { l, t, r } = actors;
  const lease = ['E2E-04', 'E2E-05'].includes(id) ? await newLease(l, t) : await funded(actors);
  evidence[id] = { environment: 'local EVM, Chromium, EIP-1193 test wallet', leaseId: lease.id, escrow: lease.address, transactions: [] };
  if (id === 'E2E-01') {
    await split(actors, lease, true);
    await visit(t, lease, 'settlement'); evidence[id].screenshots = [await screenshot(t, id, '700-100-200')];
    await withdraw(t, lease, '700'); await withdraw(l, lease, '100');
    const a = (await snapshot(lease)).accounting;
    assert.equal(a.tenantWithdrawn, '700000000'); assert.equal(a.landlordWithdrawn, '100000000'); assert.equal(a.unallocated, '200000000');
  } else if (id === 'E2E-02') {
    await split(actors, lease); const c = await openCase(actors, lease);
    await mineAt((await snapshot(lease)).activeCase.evidenceDeadline);
    await visit(r, lease, 'cases/' + c.id);
    const form = r.page.locator('form').filter({ has: r.page.getByRole('heading', { name: 'Itemized resolution', exact: true }) });
    await form.getByLabel('Overall reasoning (at least 20 characters)').fill('Fictional resolution gives landlord 50 and tenant 150 from the disputed 200.');
    await form.locator('[name=amount2]').fill('50'); await form.locator('[name=reason2]').fill('Fictional partial award for the disputed damage item.');
    await form.getByRole('button', { name: 'Save reasons & review decision', exact: true }).click(); await confirm(r);
    let live = await snapshot(lease); assert.equal(live.accounting.unallocated, '200000000');
    await mineAt(live.activeCase.challengeDeadline); await visit(l, lease, 'settlement');
    await button(l, 'Finalize the unchallenged primary decision');
    live = await snapshot(lease); assert.equal(live.accounting.tenantCredit, '850000000'); assert.equal(live.accounting.landlordCredit, '150000000');
    await withdraw(t, lease, '850'); await withdraw(l, lease, '150');
    assert.equal(await f.publicClient.readContract({ address: f.token, abi: f.tokenAbi, functionName: 'balanceOf', args: [lease.address] }), 0n);
    await visit(t, lease, 'settlement'); evidence[id].screenshots = [await screenshot(t, id, '850-150-withdrawn')];
  } else if (id === 'E2E-03') {
    await split(actors, lease); await openCase(actors, lease);
    let live = await snapshot(lease); await mineAt(live.activeCase.primaryDeadline); await visit(t, lease, 'settlement');
    await button(t, 'Escalate a primary timeout to fallback');
    live = await snapshot(lease); await mineAt(live.activeCase.fallbackDeadline); await visit(t, lease, 'settlement');
    await button(t, 'Mark fallback service timeout');
    live = await snapshot(lease); assert.equal(live.accounting.unallocated, '200000000');
    await mineAt(live.activeCase.timeoutAt); await visit(t, lease, 'settlement'); await button(t, 'Allocate under the fixed timeout policy');
    live = await snapshot(lease); assert.equal(live.accounting.tenantCredit, '900000000'); assert.equal(live.accounting.landlordCredit, '100000000');
    await withdraw(t, lease, '900'); await withdraw(l, lease, '100');
  } else if (id === 'E2E-04') {
    await button(t, 'Accept the full terms'); await button(t, 'Approve 1000 MockUSD');
    const before = await snapshot(lease), nonce = await f.publicClient.getTransactionCount({ address: f.accounts[2].address }), count = t.hashes.length;
    await t.page.getByRole('button', { name: 'Confirm deposit of 1000 MockUSD', exact: true }).click();
    await t.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(t.hashes.length, count); assert.equal(await f.publicClient.getTransactionCount({ address: f.accounts[2].address }), nonce);
    assert.deepEqual((await snapshot(lease)).accounting, before.accounting);
    assert.equal((await snapshot(lease)).phase, before.phase);
  } else if (id === 'E2E-05') {
    await button(t, 'Accept the full terms'); await button(t, 'Approve 1000 MockUSD');
    const before = await snapshot(lease), nonce = await f.publicClient.getTransactionCount({ address: f.accounts[2].address }), count = t.hashes.length;
    t.rejectNext = true;
    await t.page.getByRole('button', { name: 'Confirm deposit of 1000 MockUSD', exact: true }).click();
    await t.page.getByRole('dialog').getByRole('button', { name: 'Confirm & request signature', exact: true }).click();
    await until(async () => (await t.page.locator('.live-status').innerText()).includes('Signature request cancelled.'), 'wallet rejection feedback');
    assert.equal(t.hashes.length, count); assert.equal(await f.publicClient.getTransactionCount({ address: f.accounts[2].address }), nonce);
    assert.deepEqual((await snapshot(lease)).accounting, before.accounting);
    await t.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  } else if (id === 'E2E-06') {
    await visit(t, lease); await t.page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await until(async () => (await t.context.request.get(origin + '/api/auth/session')).status() === 401, 'server session revoked');
    await t.context.close(); actors.t = await actor(2); await login(actors.t);
    await visit(actors.t, lease);
    assert.ok((await actors.t.page.locator('body').innerText()).includes('Your role: Tenant'));
    assert.equal((await snapshot(lease)).terms.tenant.toLowerCase(), f.accounts[2].address.toLowerCase());
    const stranger = await actor(6); await login(stranger, '/leases/' + lease.id);
    await stranger.page.getByRole('alert').filter({ hasText: 'FORBIDDEN' }).waitFor(); assert.equal(await stranger.page.getByRole('heading', { name: 'Confirmed on-chain balances', exact: true }).count(), 0);
    await stranger.context.close();
  } else if (id === 'E2E-07') {
    await mineAt((await snapshot(lease)).terms.hardEndAt); await visit(t, lease, 'settlement'); await button(t, 'Execute final exit');
    await withdraw(t, lease, '1,000'); const before = (await snapshot(lease)).accounting;
    await until(async () => await t.page.getByRole('button', { name: 'Withdraw 1000 MockUSD', exact: true }).count() === 0, 'withdraw button removed');
    await assert.rejects(f.publicClient.simulateContract({ address: lease.address, abi: escrowAbi, functionName: 'withdraw', account: f.accounts[2] }));
    evidence[id].transactions.push(await f.write(f.wallets[6], lease.address, escrowAbi, 'withdrawFor', [f.accounts[2].address]));
    assert.deepEqual((await snapshot(lease)).accounting, before, 'zero-credit third-party call cannot pay twice');
  } else if (id === 'E2E-08') {
    // Shut down UI, API, DB; no Worker or sponsor service was started. RPC is independent.
    const original = { escrow: lease.address, token: f.token, tenant: f.accounts[2].address, hardEndAt: (await snapshot(lease)).terms.hardEndAt };
    const restored = privateKeyToAccount(f.keys[2]); assert.equal(restored.address, original.tenant);
    await close(proxy); next.kill('SIGTERM'); await once(next, 'exit'); await f.app.db.close(); stopped = true;
    await assert.rejects(fetch(origin + '/api/auth/session', { signal: AbortSignal.timeout(1000) }));
    await mineAt(original.hardEndAt);
    await f.publicClient.request({ method: 'hardhat_setBalance', params: [original.tenant, '0x0'] });
    const sponsor = createWalletClient({ account: privateKeyToAccount(f.keys[6]), chain: f.wallets[6].chain, transport: http(f.rpc) });
    const gasHash = await sponsor.sendTransaction({ to: original.tenant, value: 10000000000000000n });
    await f.publicClient.waitForTransactionReceipt({ hash: gasHash });
    assert.ok(await f.publicClient.getBalance({ address: original.tenant }) > 0n);
    const expiryHash = await f.write(sponsor, original.escrow, escrowAbi, 'expireEscrow');
    const before = await f.publicClient.readContract({ address: original.token, abi: f.tokenAbi, functionName: 'balanceOf', args: [original.tenant] });
    const hash = await f.write(sponsor, original.escrow, escrowAbi, 'withdrawFor', [original.tenant]);
    const after = await f.publicClient.readContract({ address: original.token, abi: f.tokenAbi, functionName: 'balanceOf', args: [original.tenant] });
    assert.equal(after - before, 1000000000n);
    assert.equal(await f.publicClient.readContract({ address: original.token, abi: f.tokenAbi, functionName: 'balanceOf', args: [sponsor.account.address] }), 0n);
    evidence[id].transactions.push(gasHash, expiryHash, hash); evidence[id].limitations = 'Original test key restored in independent client; not real passkey/device recovery.';
  }
  if (!stopped) { const a = (await snapshot(lease)).accounting; evidence[id].accounting = a;
    assert.equal(['unallocated','tenantCredit','landlordCredit','tenantWithdrawn','landlordWithdrawn'].reduce((s,k) => s + BigInt(a[k]),0n), BigInt(a.fundedAmount)); }
  evidence[id].transactions = [...new Set([...evidence[id].transactions, ...Object.values(actors).flatMap(a => a.hashes)])];
  evidence[id].receipts = await Promise.all(evidence[id].transactions.map(async hash => {
    const receipt = await f.publicClient.getTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success');
    return { hash, status: receipt.status, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash, from: receipt.from, to: receipt.to };
  }));
}
try {
  await setup();
  for (const id of ids) {
    const actors = { l: await actor(1), t: await actor(2), r: await actor(3) };
    const started = Date.now();
    try {
      f.f.setNow(Number((await f.publicClient.getBlock()).timestamp) * 1000);
      for (const a of Object.values(actors)) await login(a);
      await run(id, actors);
      for (const a of Object.values(actors)) assert.deepEqual(a.errors ?? [], [], 'Browser page errors');
      results.push({ id, passed: true, durationMs: Date.now() - started, evidence: evidence[id] });
      console.log('PASS ' + id);
    } catch (error) {
      let failureScreenshot; try { failureScreenshot = await screenshot(actors.t, id, 'failure');
        await screenshot(actors.l, id, 'landlord-failure'); await writeFile(outputDir + '/' + id + '-landlord-dom.txt', await actors.l.page.locator('body').innerText()); } catch {}
      results.push({ id, passed: false, durationMs: Date.now() - started, output: error.stack, failureScreenshot, evidence: evidence[id] });
      console.error('FAIL ' + id + ': ' + error.message);
    } finally { for (const a of Object.values(actors)) await a.context.close(); }
  }
} catch (error) {
  for (const id of ids.filter(id => !results.some(r => r.id === id))) results.push({ id, passed: false, output: 'Harness startup: ' + error.stack });
} finally {
  await browser?.close(); await close(proxy);
  if (next && next.exitCode === null) { next.kill('SIGTERM'); await once(next, 'exit'); }
  for (const fn of cleanups.reverse()) { try { await fn(); } catch {} }
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputDir + '/results.json', JSON.stringify({ environment: 'local EVM only; browser wallet substitute; scanner test double',
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    generatedAt: new Date().toISOString(), results }, null, 2));
  process.exitCode = results.length === ids.length && results.every(r => r.passed) ? 0 : 1;
}
