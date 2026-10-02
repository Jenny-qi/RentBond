import test from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fixture, client, deployed, hash } from "./helpers.mjs";
import {
  createTaskStore,
  syncLease,
} from "../../../../worker/src/persistence/backend.mjs";
import { escrowAbi } from "../chain.ts";

export async function workerFixture(t, overrides = {}) {
  const f = await fixture(t, overrides);
  const l = client(f.app),
    tenant = client(f.app),
    r = client(f.app),
    fallback = client(f.app);
  await l.login();
  await tenant.login();
  const lease = await deployed(f, l, tenant, r, fallback);
  await syncLease(f.app, lease.leaseId);
  const store = createTaskStore(f.app),
    input = {
      leaseId: lease.leaseId,
      kind: "CLOSE_CLAIMS",
      dueAt: lease.snapshot.schedule.claimDeadline,
      sourceBlock: "1",
      sourceHash: hash(500),
    };
  return { ...f, ...lease, store, input };
}
async function sign(f, extra = {}) {
  return privateKeyToAccount("0x" + "11".repeat(32)).signTransaction({
    chainId: f.app.config.chainId,
    nonce: 0,
    gas: 200000n,
    gasPrice: 1n,
    to: f.address,
    data: encodeFunctionData({ abi: escrowAbi, functionName: "closeClaims" }),
    value: 0n,
    ...extra,
  });
}
test("E adapter deduplicates canonical work, uses UTC seconds, and fences competing or expired claims", async (t) => {
  const f = await workerFixture(t),
    { store, input, advance } = f;
  const results = await Promise.all([
    store.enqueue(input),
    store.enqueue(input),
  ]);
  assert.equal(results[0].id, results[1].id);
  await assert.rejects(
    store.enqueue({ ...input, dueAt: input.sourceBlock }),
    /UTC deadline/,
  );
  await assert.rejects(
    store.enqueue({ ...input, sourceHash: hash(501) }),
    /Synchronize/,
  );
  assert.equal(await store.claim(String(BigInt(input.dueAt) - 1n)), null);
  const claims = await Promise.all([
    store.claim(input.dueAt),
    store.claim(input.dueAt),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const first = claims.find(Boolean);
  advance(120001);
  const second = await createTaskStore(f.app).claim(input.dueAt);
  assert.notEqual(first.lock_token, second.lock_token);
  await assert.rejects(
    store.prepare(first.id, first.lock_token, await sign(f)),
    /ownership/,
  );
  await store.retry(second.id, second.lock_token, "RPC_UNAVAILABLE");
  advance(10001);
  const third = await store.claim(input.dueAt);
  await store.retry(third.id, third.lock_token, "RPC_UNAVAILABLE");
  assert.equal((await store.get(third.id)).state, "failed");
  assert.equal(await store.claim(input.dueAt), null);
});

test("signed public action is durable before broadcast, mismatched value/action rejected, receipt verified and retry preserves bytes", async (t) => {
  const f = await workerFixture(t),
    { store, input, advance, app } = f;
  const job = await store.enqueue(input),
    claim = await store.claim(input.dueAt);
  await assert.rejects(
    store.prepare(job.id, claim.lock_token, await sign(f, { value: 1n })),
    /match/,
  );
  await assert.rejects(
    store.prepare(job.id, claim.lock_token, await sign(f, { data: "0x" })),
    /match/,
  );
  const raw = await sign(f),
    prepared = await store.prepare(job.id, claim.lock_token, raw);
  assert.equal(prepared.state, "prepared");
  assert.equal(prepared.raw_transaction, raw);
  advance(120001);
  const restarted = createTaskStore(app),
    retry = await restarted.claim(input.dueAt);
  assert.equal(retry.raw_transaction, raw);
  assert.equal(retry.tx_hash, prepared.tx_hash);
  assert.equal(await restarted.complete(job.id, retry.lock_token), false);
  await restarted.broadcast(job.id, retry.lock_token);
  advance(10001);
  const receiptClaim = await restarted.claim(input.dueAt);
  app.chain.receipt = async () => ({
    transactionHash: prepared.tx_hash,
    blockHash: hash(800),
    blockNumber: "2",
    status: "success",
  });
  assert.equal(await restarted.complete(job.id, receiptClaim.lock_token), true);
  assert.equal((await restarted.get(job.id)).state, "confirmed");
});

test("reorg atomically cancels unsigned work, fences signed work and requires confirmed receipt to unblock", async (t) => {
  const f = await workerFixture(t),
    { app, store, input, snapshot } = f;
  const job = await store.enqueue(input),
    claim = await store.claim(input.dueAt);
  const prepared = await store.prepare(job.id, claim.lock_token, await sign(f));
  snapshot.blockHash = hash(999);
  app.chain.blockHash = async () => hash(999);
  await syncLease(app, f.leaseId);
  assert.equal((await store.get(job.id)).state, "reconcile");
  await assert.rejects(store.broadcast(job.id, claim.lock_token), /ownership/);
  assert.equal(await store.claim(input.dueAt), null);
  assert.equal(await store.reconcile(job.id), false);
  app.chain.receipt = async () => ({
    transactionHash: prepared.tx_hash,
    blockHash: hash(999),
    blockNumber: "2",
    status: "success",
  });
  assert.equal(await store.reconcile(job.id), true);
  // A separate unsigned task is cancelled in the same projection transaction.
  snapshot.activeCase = {
    exists: true,
    caseId: "1",
    phase: 3,
    fallbackDeadline: input.dueAt,
  };
  await syncLease(app, f.leaseId);
  const unsigned = await store.enqueue({
    ...input,
    kind: "MARK_SERVICE_TIMEOUT",
    caseId: "1",
    sourceHash: hash(999),
  });
  snapshot.blockHash = hash(1000);
  app.chain.blockHash = async () => hash(1000);
  await syncLease(app, f.leaseId);
  assert.equal((await store.get(unsigned.id)).state, "cancelled");
});

test("a returning canonical source requeues cancelled unsigned work without reviving its old lock", async (t) => {
  const f = await workerFixture(t),
    { app, store, input, snapshot } = f;
  const job = await store.enqueue(input),
    first = await store.claim(input.dueAt);
  snapshot.blockHash = hash(999);
  app.chain.blockHash = async () => hash(999);
  await syncLease(app, f.leaseId);
  assert.equal((await store.get(job.id)).state, "cancelled");

  snapshot.blockHash = input.sourceHash;
  app.chain.blockHash = async () => input.sourceHash;
  await syncLease(app, f.leaseId);
  const restored = await store.enqueue(input);
  assert.equal(restored.id, job.id);
  assert.equal(restored.state, "queued");
  assert.equal(restored.attempts, 0);
  assert.equal(restored.lock_token, null);
  assert.equal(restored.raw_transaction, null);
  assert.equal(restored.error_code, null);
  await assert.rejects(
    store.prepare(job.id, first.lock_token, await sign(f)),
    /ownership/,
  );
  const second = await store.claim(input.dueAt);
  assert.equal(second.id, job.id);
  assert.notEqual(second.lock_token, first.lock_token);
});
