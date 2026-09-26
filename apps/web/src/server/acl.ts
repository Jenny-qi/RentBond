import type { Context } from "./context.ts";
import type { Row } from "./db.ts";
import { canonicalJson, verifyTermsCommitment } from "./crypto.ts";
import { requireThat } from "./errors.ts";
import type { ChainSnapshot } from "./chain.ts";

export function verifyManifest(row: Row): void {
  requireThat(
    verifyTermsCommitment(
      canonicalJson(row.terms ?? row.manifest),
      row.salt,
      row.commitment,
    ),
    409,
    "COMMITMENT_MISMATCH",
    "Private content does not match the committed version.",
  );
}
export async function leaseAccess(
  ctx: Context,
  id: string,
  roles: string[] = ["T", "L"],
) {
  const [row] = await ctx.sql.query(
    "SELECT l.*, m.role FROM leases l JOIN lease_members m ON m.lease_id=l.id WHERE l.id=$1 AND m.wallet=$2",
    [id, ctx.session.wallet],
  );
  requireThat(
    row && roles.includes(row.role),
    403,
    "FORBIDDEN",
    "You cannot access this lease.",
  );
  requireThat(
    !row.purged_at,
    410,
    "DATA_PURGED",
    "Private materials have been deleted.",
  );
  verifyManifest(row);
  return row;
}
export async function liveLease(
  ctx: Context,
  lease: Row,
): Promise<ChainSnapshot> {
  requireThat(
    lease.contract_address,
    409,
    "LEASE_NOT_DEPLOYED",
    "Lease has not been deployed.",
  );
  const live = await ctx.app.chain.lease(lease.contract_address);
  const t = live.terms;
  requireThat(
    t.termsHash.toLowerCase() === lease.commitment &&
      t.tenant.toLowerCase() === lease.tenant &&
      t.landlord.toLowerCase() === lease.landlord &&
      t.leaseId.toLowerCase() === lease.chain_lease_id,
    409,
    "CHAIN_TERMS_MISMATCH",
    "Chain roles or terms do not match the private lease.",
  );
  const roles: Record<string, string> = {
    T: t.tenant,
    L: t.landlord,
    R: t.primaryResolver,
    F: t.fallbackResolver,
  };
  requireThat(
    roles[lease.role]?.toLowerCase() === ctx.session.wallet,
    403,
    "FORBIDDEN",
    "Current chain role does not match this account.",
  );
  return live;
}
export async function caseAccess(ctx: Context, id: string) {
  const [item] = await ctx.sql.query("SELECT * FROM cases WHERE id=$1", [id]);
  requireThat(item, 403, "FORBIDDEN", "You cannot access this case.");
  const lease = await leaseAccess(ctx, item.lease_id, ["T", "L", "R", "F"]);
  if (lease.role === "T" || lease.role === "L")
    return { lease, item, live: null };
  const live = await liveLease(ctx, lease);
  const allowed = (snapshot: ChainSnapshot) => {
    const c = snapshot.activeCase;
    return (
      c.exists &&
      String(c.caseId) === item.chain_case_id &&
      ((lease.role === "R" &&
        ["1", "2"].includes(String(c.phase)) &&
        snapshot.terms.primaryResolver.toLowerCase() === ctx.session.wallet) ||
        (lease.role === "F" &&
          String(c.phase) === "3" &&
          snapshot.terms.fallbackResolver.toLowerCase() === ctx.session.wallet))
    );
  };
  requireThat(
    allowed(live),
    403,
    "FORBIDDEN",
    "This case is not assigned to you at its current stage.",
  );
  const confirmed = await ctx.app.chain.lease(lease.contract_address, true);
  requireThat(
    allowed(confirmed),
    403,
    "FORBIDDEN",
    "Case assignment is waiting for chain confirmation.",
  );
  return { lease, item, live };
}
export async function scopeAccess(
  ctx: Context,
  leaseId: string,
  caseId?: string,
) {
  if (!caseId) return leaseAccess(ctx, leaseId);
  const result = await caseAccess(ctx, caseId);
  requireThat(
    result.lease.id === leaseId,
    403,
    "FORBIDDEN",
    "Case does not belong to this lease.",
  );
  return result.lease;
}
export async function evidenceWindow(ctx: Context, caseId: string) {
  const result = await caseAccess(ctx, caseId);
  requireThat(
    ["T", "L"].includes(result.lease.role),
    403,
    "FORBIDDEN",
    "Only the parties may submit evidence.",
  );
  const live = await liveLease(ctx, result.lease);
  const c = live.activeCase;
  const deadline =
    String(c.phase) === "3"
      ? Number(c.fallbackStartAt) + Number(live.terms.timing.fallbackEvidence)
      : Number(c.evidenceDeadline);
  requireThat(
    c.exists &&
      String(c.caseId) === result.item.chain_case_id &&
      ["1", "3"].includes(String(c.phase)) &&
      live.chainTime < deadline &&
      live.chainTime < Number(live.terms.hardEndAt),
    409,
    "EVIDENCE_WINDOW_CLOSED",
    "The evidence window is closed.",
  );
  return result;
}
