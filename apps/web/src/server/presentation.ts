import type { Context } from "./context.ts";
import type { Row } from "./db.ts";
import { verifyManifest } from "./acl.ts";

export async function privateHistory(
  ctx: Context,
  leaseId: string,
  caseId?: string,
) {
  const events = await ctx.sql.query(
    "SELECT event_name,payload,tx_hash,block_number FROM chain_events WHERE lease_id=$1 AND canonical=true ORDER BY block_number,log_index",
    [leaseId],
  );
  const statements = await ctx.sql.query(
    "SELECT * FROM statements WHERE lease_id=$1 AND ($2::uuid IS NULL OR case_id=$2) ORDER BY created_at,id",
    [leaseId, caseId ?? null],
  );
  const claims = await ctx.sql.query(
    "SELECT * FROM claim_drafts WHERE lease_id=$1 ORDER BY created_at,id",
    [leaseId],
  );
  const [lease] = await ctx.sql.query(
    "SELECT projection FROM leases WHERE id=$1",
    [leaseId],
  );
  const visibleStatements = statements.filter(
    (s) =>
      s.author === ctx.session.wallet ||
      events.some((e) => Object.values(e.payload).includes(s.commitment)),
  );
  const visibleClaims = claims.filter(
    (d) =>
      d.author === ctx.session.wallet ||
      d.manifest.items.every((item: Row) =>
        lease.projection?.claims?.some(
          (c: Row) => c.commitment === item.commitment,
        ),
      ),
  );
  visibleStatements.forEach(verifyManifest);
  visibleClaims.forEach(verifyManifest);
  return {
    events,
    statements: visibleStatements.map(({ id, manifest, salt, commitment }) => ({
      id,
      manifest,
      salt,
      commitment,
    })),
    claims: visibleClaims.map(({ id, manifest, salt, commitment }) => ({
      id,
      manifest,
      salt,
      commitment,
    })),
  };
}
export async function evidenceStatus(
  ctx: Context,
  lease: Row,
  bundle: Row,
  events: Row[],
) {
  const committed = events.find(
    (e) =>
      e.event_name === "EvidenceCommitted" &&
      e.payload.submitter?.toLowerCase() === bundle.manifest.author &&
      e.payload.bundleId === bundle.manifest.bundleId &&
      String(e.payload.version) === String(bundle.manifest.version) &&
      e.payload.commitment === bundle.commitment,
  );
  // The contract's acknowledgement event omits bundleId/hash; read the exact record instead.
  const record = lease.contract_address
    ? await ctx.app.chain.evidence(
        lease.contract_address,
        bundle.manifest.author,
        bundle.manifest.bundleId,
        bundle.manifest.version,
      )
    : null;
  const anchored = !!record?.exists && record.commitment === bundle.commitment;
  return {
    ...bundle,
    onChain: anchored,
    acknowledged: anchored && !!record?.acknowledged,
    agreed: anchored && record?.acknowledged ? record.agreed : null,
    recordedTransaction: committed?.tx_hash ?? null,
    lastCheckedBlock: record?.blockNumber ?? null,
  };
}
