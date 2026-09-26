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
    "SELECT * FROM statements WHERE lease_id=$1 ORDER BY created_at,id",
    [leaseId],
  );
  const [item] = caseId
    ? await ctx.sql.query(
        "SELECT chain_case_id,snapshot FROM cases WHERE id=$1 AND lease_id=$2",
        [caseId, leaseId],
      )
    : [];
  const opening = item
    ? events.findIndex(
        (e) =>
          e.event_name === "CaseOpened" &&
          String(e.payload.caseId) === item.chain_case_id,
      )
    : -1;
  const checkoutHash =
    opening < 0
      ? undefined
      : events
          .slice(0, opening)
          .findLast((e) => e.event_name === "CheckoutRequested")?.payload
          .evidenceHash;
  const inScope = (s: Row) =>
    !caseId ||
    s.case_id === caseId ||
    (!s.case_id &&
      ((Number(item?.snapshot.caseType) === 2 && s.kind === "claim-response") ||
        (Number(item?.snapshot.caseType) === 1 &&
          s.kind === "checkout" &&
          s.commitment === checkoutHash)));
  const anchored = (s: Row) =>
    events.some((e) => Object.values(e.payload).includes(s.commitment));
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
      inScope(s) &&
      (s.author === ctx.session.wallet ||
        anchored(s) ||
        s.kind === "evidence-withdrawal"),
  );
  const claimAnchored = (d: Row) =>
    d.manifest.items.every((item: Row) =>
      lease.projection?.claims?.some(
        (c: Row) => c.commitment === item.commitment,
      ),
    );
  const visibleClaims = claims.filter(
    (d) =>
      d.author === ctx.session.wallet ||
      ((!caseId || Number(item?.snapshot.caseType) === 2) && claimAnchored(d)),
  );
  visibleStatements.forEach(verifyManifest);
  visibleClaims.forEach(verifyManifest);
  return {
    events,
    statements: visibleStatements.map((s) => ({
      id: s.id,
      manifest: s.manifest,
      salt: s.salt,
      commitment: s.commitment,
      author: s.author,
      savedAt: Number(s.created_at),
      onChain: anchored(s),
    })),
    claims: visibleClaims.map((d) => ({
      id: d.id,
      manifest: d.manifest,
      salt: d.salt,
      commitment: d.commitment,
      author: d.author,
      savedAt: Number(d.created_at),
      onChain: claimAnchored(d),
    })),
  };
}
// Call only after caseAccess/scopeAccess; do not broaden one case to every lease file.
export async function caseMaterialRefs(
  ctx: Context,
  leaseId: string,
  caseId: string,
): Promise<Row[]> {
  const bundles = await ctx.sql.query(
    "SELECT * FROM evidence_bundles WHERE lease_id=$1 AND case_id=$2",
    [leaseId, caseId],
  );
  bundles.forEach(verifyManifest);
  const history = await privateHistory(ctx, leaseId, caseId);
  return [
    ...bundles.flatMap((b) =>
      b.manifest.items.flatMap((i: Row) => i.documents),
    ),
    ...history.claims
      .filter((c) => c.onChain)
      .flatMap((c) =>
        c.manifest.items.flatMap((i: Row) => i.manifest.documents),
      ),
    ...history.statements
      .filter((s) => s.onChain)
      .flatMap((s) => s.manifest.documents ?? []),
  ];
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
