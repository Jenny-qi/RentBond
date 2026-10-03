import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import { createServer } from 'node:http';
import { liveWorkerFixture } from './worker-fixture.mjs';
import { openDatabase } from '../db.ts';
import { escrowAbi, createChain } from '../chain.ts';
import { createTaskStore } from '../worker-tasks.ts';
import { plannedActions } from '../worker-actions.ts';
import { createWorkerRpc } from '../../../../worker/src/rpc.mjs';
import { syncFactory, runIndexerCycle } from '../../../../worker/src/indexer/loop.ts';
import { runExecutorCycle } from '../../../../worker/src/jobs/executor.ts';
import { runWorker } from '../../../../worker/src/main.ts';

const rpcFor = (f) => createWorkerRpc(f.config, privateKeyToAccount(f.keys[6]));
const mineAt = async (f, seconds) => {
  await f.publicClient.request({ method: 'evm_setNextBlockTimestamp', params: [Number(seconds)] });
  await f.publicClient.request({ method: 'evm_mine', params: [] });
};
const row = async (f) => (await f.app.db.query('SELECT * FROM leases WHERE id=$1', [f.leaseId]))[0];
async function openClaims(f) {
  await mineAt(f, f.prepare.data.terms.leaseEndAt);
  await f.write(f.lw, f.escrow, escrowAbi, 'startScheduledSettlement');
  return f.app.chain.lease(f.escrow, true);
}
async function runUntilConfirmed(f, rpc) {
  for (let i = 0; i < 6; i++) {
    await runIndexerCycle(f.app, rpc, f.config);
    const result = await runExecutorCycle(f.app, rpc);
    if (result.state === 'confirmed') return result;
    f.f.advance(10001);
  }
  assert.fail('No confirmed Worker action');
}

test('IT-03 real EVM factory discovery, ABI decoding, attachment and duplicate replay', { timeout: 180000 }, async (t) => {
  let foundBeforeAttach;
  const f = await liveWorkerFixture(t, { beforeAttach: async (app) => {
    await syncFactory(app, createWorkerRpc(app.config), { deploymentBlock: 0n, batchSize: 1000 });
    [foundBeforeAttach] = await app.db.query("SELECT * FROM chain_events WHERE event_name='LeaseCreated'");
    assert.equal(foundBeforeAttach.lease_id, null);
  } });
  const rpc = rpcFor(f);
  await runIndexerCycle(f.app, rpc, f.config);
  const before = await row(f);
  assert.equal(before.projection.accounting.fundedAmount, '1000000000');
  const [created] = await f.app.db.query("SELECT * FROM chain_events WHERE event_name='LeaseCreated'");
  assert.equal(created.lease_id, f.leaseId);
  assert.equal(created.payload.escrow.toLowerCase(), f.escrow);
  assert.equal(created.payload.tenant.toLowerCase(), f.tenant.wallet);
  const events = await f.app.db.query('SELECT * FROM chain_events ORDER BY tx_hash,log_index');
  assert.ok(events.some((e) => e.event_name === 'Funded'));
  for (let i = 0; i < 3; i++) await runIndexerCycle(f.app, createWorkerRpc(f.config), f.config);
  assert.deepEqual(await f.app.db.query('SELECT * FROM chain_events ORDER BY tx_hash,log_index'), events);
  assert.deepEqual((await row(f)).projection.accounting, before.projection.accounting);
  const jobs = await f.app.db.query('SELECT kind FROM worker_tasks');
  assert.equal(jobs.filter((j) => j.kind === 'START_SETTLEMENT').length, 1);
});

test('IT-04 real EVM reorg invalidates events, projection and unsigned tasks atomically', { timeout: 180000 }, async (t) => {
  const f = await liveWorkerFixture(t), rpc = rpcFor(f);
  await runIndexerCycle(f.app, rpc, f.config);
  const oldJobs = await f.app.db.query('SELECT id FROM worker_tasks');
  assert.equal((await row(f)).projection.accounting.fundedAmount, '1000000000');
  await f.publicClient.request({ method: 'evm_revert', params: [f.beforeFunding] });
  await f.publicClient.request({ method: 'evm_mine', params: [] });
  await runIndexerCycle(f.app, rpc, f.config);
  assert.equal((await row(f)).projection.accounting.fundedAmount, '0');
  const [oldFunding] = await f.app.db.query('SELECT canonical FROM chain_events WHERE tx_hash=$1', [f.fundingTx]);
  assert.equal(oldFunding.canonical, false);
  for (const j of oldJobs) assert.equal((await createTaskStore(f.app).get(j.id)).state, 'cancelled');
  await f.write(f.tw, f.escrow, escrowAbi, 'fund', [1000000000n]);
  await runIndexerCycle(f.app, rpc, f.config);
  assert.equal((await row(f)).projection.accounting.fundedAmount, '1000000000');
  assert.equal((await f.app.db.query("SELECT * FROM chain_events WHERE event_name='Funded' AND canonical=true")).length, 1);
});

test('IT-05 real process restart reconciles a persisted broadcast without signing twice', { timeout: 180000 }, async (t) => {
  const f = await liveWorkerFixture(t, { persistent: true }), rpc = rpcFor(f);
  const snapshot = await openClaims(f);
  await mineAt(f, snapshot.schedule.claimDeadline);
  await runIndexerCycle(f.app, rpc, f.config);
  const store = createTaskStore(f.app);
  // Simulate the crash window after the network accepted bytes and before the
  // sender recorded broadcast. The claim expires before the replacement process.
  f.app.now = () => Date.now() - 121000;
  let claim = await store.claim((await rpc.head()).timestamp.toString());
  assert.equal(claim.kind, 'CLOSE_CLAIMS');
  claim.contract_address = f.escrow;
  const live = await f.app.chain.lease(f.escrow, true);
  const raw = await rpc.prepare(claim, live);
  const prepared = await store.prepare(claim.id, claim.lock_token, raw);
  await rpc.broadcast({ ...prepared, contract_address: f.escrow }, live);
  const nonce = await f.publicClient.getTransactionCount({ address: f.accounts[6].address });
  const keyFile = join(f.app.config.dataDir, 'ephemeral-worker-test.key');
  await writeFile(keyFile, f.keys[6], { mode: 0o600 });
  await f.app.db.close();
  const root = fileURLToPath(new URL('../../../../../', import.meta.url));
  const child = spawn(process.execPath, ['apps/worker/src/main.ts', '--once'], {
    cwd: root,
    env: { ...process.env, NEXT_PUBLIC_APP_ENV: 'local', NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      SESSION_SECRET: f.app.config.sessionSecret, CHAIN_ID: '10143', NEXT_PUBLIC_CHAIN_ID: '10143',
      RENTBOND_DATA_DIR: f.app.config.dataDir, RPC_URL: f.config.rpcUrl, DATABASE_URL: '',
      NEXT_PUBLIC_FACTORY_ADDRESS: f.config.factoryAddress, DEPLOYMENT_BLOCK: '0',
      WORKER_EXECUTE: 'true', WORKER_PRIVATE_KEY_FILE: keyFile, WORKER_GAS_ACCOUNT: f.accounts[6].address,
      WORKER_MAX_FEE_WEI: '1000000000000000000', FILE_SCAN_MODE: 'disabled-local', TEST_GAS_SPONSOR_PRIVATE_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => output += d);
  child.stderr.on('data', (d) => output += d);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  f.app.db = await openDatabase(f.app.config);
  assert.equal(code, 0, output);
  const restored = await createTaskStore(f.app).get(claim.id);
  assert.equal(restored.raw_transaction, raw);
  assert.equal(restored.state, 'confirmed');
  assert.equal(await f.publicClient.getTransactionCount({ address: f.accounts[6].address }), nonce);
  const result = await f.app.chain.lease(f.escrow, true);
  assert.equal(result.accounting.tenantCredit, '1000000000');
  assert.equal(result.accounting.unallocated, '0');
});

test('IT-06 RPC fault and wrong fallback never overwrite confirmed balances or sign', { timeout: 180000 }, async (t) => {
  const f = await liveWorkerFixture(t), rpc = rpcFor(f);
  await runIndexerCycle(f.app, rpc, f.config);
  const before = (await row(f)).projection;
  const chain = f.app.chain;
  f.app.chain = { ...chain, events: async () => { throw new Error('Injected outage'); } };
  await f.publicClient.request({ method: 'evm_mine', params: [] });
  await assert.rejects(runIndexerCycle(f.app, rpc, f.config), /Injected outage/);
  assert.deepEqual((await row(f)).projection, before);
  f.app.chain = chain;
  const server = createServer((req, res) => {
    let data = ''; req.on('data', (d) => data += d); req.on('end', () => {
      const { id } = JSON.parse(data); res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: '0x1' }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(createWorkerRpc({ ...f.config, rpcFallbackUrl: `http://127.0.0.1:${server.address().port}` }).head(), /RPC_CHAIN_MISMATCH/);
  assert.deepEqual((await row(f)).projection, before);
  await runIndexerCycle(f.app, rpc, f.config);
});

test('Worker advances public deadlines, respects boundary and manual progress, and stops gracefully', { timeout: 180000 }, async (t) => {
  const f = await liveWorkerFixture(t), rpc = rpcFor(f);
  await mineAt(f, f.prepare.data.terms.leaseEndAt - 1);
  await runIndexerCycle(f.app, rpc, f.config);
  assert.equal((await runExecutorCycle(f.app, rpc)).state, 'idle');
  await mineAt(f, f.prepare.data.terms.leaseEndAt);
  await runUntilConfirmed(f, rpc);
  let live = await f.app.chain.lease(f.escrow, true);
  assert.equal(live.phase, 5);
  await f.write(f.lw, f.escrow, escrowAbi, 'submitClaims', [[{amount: 100000000n, commitment: '0x' + '12'.repeat(32)}]]);
  await f.write(f.tw, f.escrow, escrowAbi, 'respondClaim', [1n, true, '0x' + '34'.repeat(32)]);
  await runIndexerCycle(f.app, rpc, f.config);
  await mineAt(f, live.schedule.claimDeadline);
  // A human advances while the Worker is offline. Resume must cancel the old task.
  await f.write(f.lw, f.escrow, escrowAbi, 'closeClaims');
  const nonce = await f.publicClient.getTransactionCount({ address: f.accounts[6].address });
  assert.equal((await runExecutorCycle(f.app, rpc)).state, 'cancelled');
  assert.equal(await f.publicClient.getTransactionCount({ address: f.accounts[6].address }), nonce);
  live = await f.app.chain.lease(f.escrow, true);
  assert.equal(live.accounting.tenantCredit, '900000000');
  assert.equal(live.accounting.landlordCredit, '100000000');
  const stop = new AbortController(); stop.abort();
  await runWorker(f.app, { head: () => assert.fail('stopped worker made RPC request') }, f.config, { signal: stop.signal });
  assert.deepEqual(plannedActions(live), []);
});

test('Worker dispatches service timeout and final allocation separately', { timeout: 180000 }, async (t) => {
  const f = await liveWorkerFixture(t), rpc = rpcFor(f);
  let live = await openClaims(f);
  await f.write(f.lw, f.escrow, escrowAbi, 'submitClaims', [[{amount: 100000000n, commitment: '0x' + '56'.repeat(32)}]]);
  for (const [deadline, phase] of [['claimDeadline', 6], ['responseDeadline', 7], ['primaryDeadline', 7], ['fallbackDeadline', 8], ['timeoutAt', 10]]) {
    await mineAt(f, live.schedule[deadline] || live.activeCase[deadline]);
    await runUntilConfirmed(f, rpc);
    live = await f.app.chain.lease(f.escrow, true);
    assert.equal(live.phase, phase);
    if (deadline === 'fallbackDeadline') assert.equal(live.accounting.unallocated, '100000000');
  }
  assert.equal(live.accounting.tenantCredit, '1000000000');
  assert.equal(live.accounting.landlordCredit, '0');
  assert.equal(live.accounting.unallocated, '0');
  const done = await f.app.db.query("SELECT kind FROM worker_tasks WHERE state='confirmed'");
  for (const kind of ['CLOSE_CLAIMS','OPEN_CLAIM_CASE','ESCALATE_TIMEOUT','MARK_SERVICE_TIMEOUT','FINALIZE_TIMEOUT']) assert.ok(done.some(j => j.kind === kind));
});
