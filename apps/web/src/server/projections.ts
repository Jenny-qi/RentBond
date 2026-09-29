import { randomUUID } from "node:crypto";
import type { App, Context } from "./context.ts";
import type { Sql, Row } from "./db.ts";
import type { ChainSnapshot } from "./chain.ts";
import { leaseAccess, verifyManifest } from "./acl.ts";
import { requireThat } from "./errors.ts";
import { canonicalJson } from "./crypto.ts";
import { hash } from "./schemas.ts";
import { z } from "zod";
import { audit } from "./auth.ts";

function checkTerms(lease: Row, live: ChainSnapshot) {
  verifyManifest(lease);
  const t = live.terms,
    expected = lease.terms;
  const service = expected.service;
  requireThat(
    service &&
      lease.prepared_at &&
      t.termsHash === lease.commitment &&
      t.landlord.toLowerCase() === lease.landlord &&
      t.tenant.toLowerCase() === lease.tenant &&
      t.depositAmount === expected.depositAmount &&
      Number(t.leaseEndAt) === expected.leaseEndAt &&
      Number(t.hardEndAt) === expected.hardEndAt &&
      Number(t.acceptDeadline) === expected.acceptDeadline &&
      t.timeoutPolicy === expected.timeoutPolicy &&
      t.serviceProfileId === service.profileId &&
      t.serviceTermsHash === service.serviceTermsHash &&
      t.registryAddress.toLowerCase() === service.registryAddress &&
      t.primaryResolver.toLowerCase() ===
        service.primaryResolver.toLowerCase() &&
      t.fallbackResolver.toLowerCase() ===
        service.fallbackResolver.toLowerCase() &&
      t.token.toLowerCase() === service.token.toLowerCase() &&
      t.ruleVersion === service.ruleVersion &&
      t.timingProfileId === service.timingProfileId &&
      canonicalJson(t.timing) === canonicalJson(service.timing),
    409,
    "CHAIN_TERMS_MISMATCH",
    "Deployed contract does not match the prepared terms.",
  );
}
async function saveSnapshot(
  sql: Sql,
  lease: Row,
  live: ChainSnapshot,
  now: number,
) {
  checkTerms(lease, live);
  await sql.query(
    "UPDATE leases SET projection=$1,synced_at=$2,sync_block=$3,sync_block_hash=$4,closed_at=CASE WHEN $5 THEN COALESCE(closed_at,$2) ELSE NULL END WHERE id=$6",
    [
      JSON.stringify(live),
      now,
      live.blockNumber,
      live.blockHash,
      live.phase === 11,
      lease.id,
    ],
  );
  for (const [role, wallet] of [
    ["R", live.terms.primaryResolver],
    ["F", live.terms.fallbackResolver],
  ]) {
    const existing = await sql.query(
      "SELECT wallet FROM lease_members WHERE lease_id=$1 AND role=$2",
      [lease.id, role],
    );
    requireThat(
      !existing.length || existing[0].wallet === wallet.toLowerCase(),
      409,
      "CHAIN_TERMS_MISMATCH",
      "Resolver snapshot cannot change.",
    );
    await sql.query(
      "INSERT INTO lease_members(lease_id,wallet,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [lease.id, wallet.toLowerCase(), role],
    );
  }
  if (live.activeCase.exists) {
    await sql.query(
      "INSERT INTO cases(id,lease_id,chain_case_id,snapshot,synced_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(lease_id,chain_case_id) DO UPDATE SET snapshot=EXCLUDED.snapshot,synced_at=EXCLUDED.synced_at",
      [
        randomUUID(),
        lease.id,
        String(live.activeCase.caseId),
        JSON.stringify({ ...live.activeCase, canonical: true }),
        now,
      ],
    );
  }
}
export async function attachDeployment(
  ctx: Context,
  leaseId: string,
  body: unknown,
) {
  const { transactionHash } = z
    .object({ transactionHash: hash })
    .strict()
    .parse(body);
  const lease = await leaseAccess(ctx, leaseId, ["L"]);
  requireThat(
    lease.prepared_at,
    409,
    "DRAFT_NOT_PREPARED",
    "Prepare and freeze terms before deploying.",
  );
  const logs = await ctx.app.chain.creation(transactionHash);
  const matches = logs.filter(
    (log) =>
      log.args.termsHash === lease.commitment &&
      log.args.landlord.toLowerCase() === lease.landlord &&
      log.args.tenant.toLowerCase() === lease.tenant,
  );
  requireThat(
    matches.length === 1,
    422,
    "INVALID_DEPLOYMENT",
    "Transaction does not contain this lease creation.",
  );
  const created = matches[0],
    address = created.args.escrow.toLowerCase();
  requireThat(
    !lease.contract_address || lease.contract_address === address,
    409,
    "ALREADY_DEPLOYED",
    "Lease already has a deployment.",
  );
  const live = await ctx.app.chain.lease(address, true);
  checkTerms(lease, live);
  requireThat(
    live.terms.leaseId === created.args.leaseId,
    409,
    "CHAIN_TERMS_MISMATCH",
    "Lease identifier differs from the factory event.",
  );
  await ctx.sql.query(
    "UPDATE leases SET contract_address=$1,chain_lease_id=$2 WHERE id=$3",
    [address, live.terms.leaseId, lease.id],
  );
  await saveSnapshot(ctx.sql, lease, live, ctx.now);
  await recordEvents(ctx.sql, ctx.app.config.chainId, lease.id, [created]);
  await audit(
    ctx.sql,
    ctx.session.wallet,
    "lease.attach",
    lease.id,
    ctx.now,
    ctx.requestId,
  );
  return {
    leaseId,
    contractAddress: address,
    chainLeaseId: live.terms.leaseId,
    syncedAt: ctx.now,
  };
}
export async function recordEvents(
  sql: Sql,
  chainId: number,
  leaseId: string,
  events: Row[],
) {
  for (const event of events) {
    await sql.query(
      "INSERT INTO chain_events(chain_id,tx_hash,log_index,block_hash,block_number,contract_address,lease_id,event_name,payload,canonical) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true) ON CONFLICT(chain_id,tx_hash,log_index) DO UPDATE SET block_hash=EXCLUDED.block_hash,block_number=EXCLUDED.block_number,canonical=true,payload=EXCLUDED.payload",
      [
        chainId,
        event.transactionHash,
        event.logIndex,
        event.blockHash,
        event.blockNumber,
        event.address.toLowerCase(),
        leaseId,
        event.eventName,
        JSON.stringify(event.args),
      ],
    );
  }
}
/** Worker-facing reconciliation: chain reads only, atomic event/checkpoint/projection persistence. */
export async function syncLease(app: App, id: string): Promise<void> {
  await app.db.transaction(async (sql) => {
    const [lease] = await sql.query("SELECT * FROM leases WHERE id=$1", [id]);
    requireThat(
      lease?.contract_address,
      409,
      "LEASE_NOT_DEPLOYED",
      "Lease has not been deployed.",
    );
    let live = await app.chain.lease(lease.contract_address, true);
    const [checkpoint] = await sql.query(
      "SELECT * FROM chain_checkpoints WHERE chain_id=$1 AND contract_address=$2",
      [app.config.chainId, lease.contract_address],
    );
    const [creation] = await sql.query(
      "SELECT MIN(block_number) AS block FROM chain_events WHERE lease_id=$1 AND event_name='LeaseCreated' AND canonical=true",
      [id],
    );
    requireThat(
      creation?.block !== null,
      409,
      "DEPLOYMENT_EVENT_MISSING",
      "Attach the confirmed factory creation before synchronizing.",
    );
    const deploymentBlock = BigInt(creation.block);
    let start = checkpoint
      ? BigInt(checkpoint.block_number) + 1n
      : deploymentBlock;
    if (
      checkpoint &&
      (BigInt(checkpoint.block_number) > BigInt(live.blockNumber) ||
        (await app.chain.blockHash(checkpoint.block_number)) !==
          checkpoint.block_hash)
    ) {
      await sql.query(
        "UPDATE chain_events SET canonical=false WHERE lease_id=$1 AND contract_address=$2",
        [id, lease.contract_address],
      );
      await sql.query(
        "UPDATE cases SET snapshot=snapshot || $1::jsonb WHERE lease_id=$2",
        [JSON.stringify({ canonical: false }), id],
      );
      start = deploymentBlock;
    }
    // Bound each job's RPC work and keep its snapshot at the same checkpoint as its events.
    const target =
      start + 999n < BigInt(live.blockNumber)
        ? start + 999n
        : BigInt(live.blockNumber);
    if (target < BigInt(live.blockNumber))
      live = await app.chain.lease(
        lease.contract_address,
        true,
        target.toString(),
      );
    for (let block = start; block <= BigInt(live.blockNumber); block += 1000n) {
      const end =
        block + 999n < BigInt(live.blockNumber)
          ? block + 999n
          : BigInt(live.blockNumber);
      await recordEvents(
        sql,
        app.config.chainId,
        id,
        await app.chain.events(
          lease.contract_address,
          block.toString(),
          end.toString(),
        ),
      );
    }
    requireThat(
      (await app.chain.blockHash(live.blockNumber)) === live.blockHash,
      503,
      "TX_REORG",
      "Chain changed during synchronization.",
    );
    await saveSnapshot(sql, lease, live, app.now());
    await sql.query(
      "INSERT INTO chain_checkpoints(chain_id,contract_address,block_number,block_hash) VALUES($1,$2,$3,$4) ON CONFLICT(chain_id,contract_address) DO UPDATE SET block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash",
      [
        app.config.chainId,
        lease.contract_address,
        live.blockNumber,
        live.blockHash,
      ],
    );
  });
}
