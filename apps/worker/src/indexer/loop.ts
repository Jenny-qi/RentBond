import { recordEvents, syncLease } from '../../../web/src/server/projections.ts';
import { invalidateWorkerTasks, createTaskStore } from '../../../web/src/server/worker-tasks.ts';
import { plannedActions } from '../../../web/src/server/worker-actions.ts';
import type { App } from '../../../web/src/server/context.ts';

// Factory discovery is public metadata. A discovery never creates a private lease
// or impersonates its landlord: the existing authenticated attachment API does that.
export async function syncFactory(app: App, rpc: any, config: any) {
  const factory = app.config.factoryAddress!.toLowerCase();
  const head = await rpc.head();
  return app.db.transaction(async (sql) => {
    const [checkpoint] = await sql.query('SELECT * FROM chain_checkpoints WHERE chain_id=$1 AND contract_address=$2', [app.config.chainId, factory]);
    let from = checkpoint ? BigInt(checkpoint.block_number) + 1n : config.deploymentBlock;
    const changed = checkpoint && (BigInt(checkpoint.block_number) > head.number ||
      (await rpc.block(checkpoint.block_number)).hash !== checkpoint.block_hash);
    if (changed) {
      // Replay conservatively from deployment. Invalidate tasks and visibility in
      // the same transaction as the factory cursor; signed bytes remain fenced.
      await sql.query('UPDATE chain_events SET canonical=false WHERE chain_id=$1', [app.config.chainId]);
      const leases = await sql.query('SELECT id FROM leases WHERE chain_id=$1 AND contract_address IS NOT NULL', [app.config.chainId]);
      for (const lease of leases) {
        await invalidateWorkerTasks(sql, lease.id, app.now());
        await sql.query("UPDATE cases SET snapshot=snapshot || '{\"canonical\":false}'::jsonb WHERE lease_id=$1", [lease.id]);
      }
      await sql.query('UPDATE leases SET projection=NULL,synced_at=NULL,sync_block=NULL,sync_block_hash=NULL WHERE chain_id=$1 AND contract_address IS NOT NULL', [app.config.chainId]);
      await sql.query('DELETE FROM chain_checkpoints WHERE chain_id=$1', [app.config.chainId]);
      from = config.deploymentBlock;
    }
    if (from > head.number) return { head, caughtUp: true, discovered: 0 };
    const to = from + BigInt(config.batchSize) - 1n < head.number ? from + BigInt(config.batchSize) - 1n : head.number;
    const anchor = await rpc.block(to);
    const events = await rpc.factoryEvents(from, to);
    events.sort((a: any, b: any) => BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : BigInt(a.blockNumber) > BigInt(b.blockNumber) ? 1 : a.logIndex - b.logIndex);
    const hashes = new Map<string, string>();
    for (const event of events) {
      const number = BigInt(event.blockNumber);
      if (event.address.toLowerCase() !== factory || number < from || number > to) throw new Error('FACTORY_LOG_MISMATCH');
      if (!hashes.has(event.blockNumber)) hashes.set(event.blockNumber, (await rpc.block(number)).hash);
      if (hashes.get(event.blockNumber) !== event.blockHash) throw new Error('TX_REORG');
      const [lease] = event.eventName === 'LeaseCreated' ? await sql.query('SELECT id FROM leases WHERE chain_id=$1 AND contract_address=$2', [app.config.chainId, event.args.escrow.toLowerCase()]) : [];
      await recordEvents(sql, app.config.chainId, lease?.id ?? null, [event]);
    }
    if ((await rpc.block(to)).hash !== anchor.hash) throw new Error('TX_REORG');
    await sql.query('INSERT INTO chain_checkpoints(chain_id,contract_address,block_number,block_hash) VALUES($1,$2,$3,$4) ON CONFLICT(chain_id,contract_address) DO UPDATE SET block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash', [app.config.chainId, factory, to.toString(), anchor.hash]);
    return { head, caughtUp: to === head.number, discovered: events.filter((e: any) => e.eventName === 'LeaseCreated').length };
  });
}

export async function runIndexerCycle(app: App, rpc: any, config: any) {
  const discovery = await syncFactory(app, rpc, config);
  const store = createTaskStore(app);
  const leases = await app.db.query('SELECT id,contract_address FROM leases WHERE chain_id=$1 AND contract_address IS NOT NULL AND purged_at IS NULL ORDER BY id', [app.config.chainId]);
  for (const lease of leases) {
    const [creation] = await app.db.query("SELECT tx_hash FROM chain_events WHERE chain_id=$1 AND contract_address=$2 AND event_name='LeaseCreated' AND canonical=true AND lower(payload->>'escrow')=$3 LIMIT 1", [app.config.chainId, app.config.factoryAddress!.toLowerCase(), lease.contract_address]);
    // A rolled-back creation must be rediscovered before restoring its projection.
    if (!creation) continue;
    await syncLease(app, lease.id);
    const [current] = await app.db.query('SELECT * FROM leases WHERE id=$1', [lease.id]);
    for (const candidate of plannedActions(current.projection)) {
      await store.enqueue({ leaseId: lease.id, ...candidate,
        sourceBlock: String(current.sync_block), sourceHash: current.sync_block_hash });
    }
  }
  return discovery;
}
