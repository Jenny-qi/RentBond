import type { App } from '../../../web/src/server/context.ts';
import { createTaskStore } from '../../../web/src/server/worker-tasks.ts';
import { syncLease } from '../../../web/src/server/projections.ts';
import { actionMatches } from '../../../web/src/server/worker-actions.ts';

/** One serialized, durable action. No wall-clock deadline or unpersisted broadcast. */
export async function runExecutorCycle(app: App, rpc: any) {
  const store = createTaskStore(app);
  // Reconciliation only confirms existing receipts. Absent/uncertain signed work
  // remains blocked for operator inspection, never replaced with another nonce.
  const pending = await app.db.query("SELECT id FROM worker_tasks WHERE state='reconcile' ORDER BY created_at");
  for (const row of pending) await store.reconcile(row.id);
  const head = await rpc.head();
  const job = await store.claim(head.timestamp.toString());
  if (!job) return { state: 'idle' };
  try {
    const [lease] = await app.db.query('SELECT * FROM leases WHERE id=$1', [job.lease_id]);
    if (!lease || lease.purged_at) throw new Error('LEASE_UNAVAILABLE');
    const work = { ...job, contract_address: lease.contract_address };
    // The receipt always wins over simulation: an already applied action can no
    // longer be simulated in its old phase, but must still be recorded confirmed.
    if (work.raw_transaction && await store.complete(job.id, job.lock_token)) return { state: 'confirmed', id: job.id };
    await syncLease(app, job.lease_id);
    const live = await app.chain.lease(lease.contract_address, true);
    if (!actionMatches(work, live)) {
      if (work.raw_transaction) await store.retry(job.id, job.lock_token, 'SIGNED_STATE_CHANGED');
      else await store.cancel(job.id, job.lock_token);
      return { state: work.raw_transaction ? 'reconcile' : 'cancelled', id: job.id };
    }
    if (BigInt(live.chainTime) < BigInt(job.due_at)) throw new Error('DEADLINE_NOT_REACHED');
    // Recheck latest too; an unconfirmed manual advance must not trigger a second tx.
    const latest = await app.chain.lease(lease.contract_address);
    if (!actionMatches(work, latest)) throw new Error('STATE_CHANGED');
    if (!work.raw_transaction) {
      const [role] = await app.db.query('SELECT wallet FROM lease_members WHERE wallet=$1 LIMIT 1', [rpc.account]);
      if (role) throw new Error('WORKER_ROLE_ACCOUNT');
      const raw = await rpc.prepare(work, live);
      Object.assign(work, await store.prepare(job.id, job.lock_token, raw));
    }
    // A reorg or concurrent synchronization may revoke ownership after signing.
    const owned = await store.get(job.id);
    if (owned?.lock_token !== job.lock_token || Number(owned.locked_until) <= app.now() || !['prepared', 'broadcast'].includes(owned.state)) throw new Error('TASK_LOCK_LOST');
    await rpc.broadcast(work, live);
    await store.broadcast(job.id, job.lock_token);
    return { state: 'broadcast', id: job.id };
  } catch {
    // Never log provider error text (RPC credentials/raw transaction may be in it).
    try { await store.retry(job.id, job.lock_token, 'WORKER_ATTEMPT_FAILED'); } catch { /* lease ownership was revoked; database fence is authoritative */ }
    return { state: (await store.get(job.id))?.state ?? 'failed', id: job.id };
  }
}
