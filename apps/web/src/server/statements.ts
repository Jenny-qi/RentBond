import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Context } from "./context.ts";
import type { Row } from "./db.ts";
import { caseAccess, leaseAccess, liveLease, verifyManifest } from "./acl.ts";
import { documentRef, timestamp, hash } from "./schemas.ts";
import { newCommitment } from "./crypto.ts";
import { materialRefs } from "./documents.ts";
import { requireThat } from "./errors.ts";

const zeroAmount = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,77})$/)
  .pipe(z.string().refine((v) => BigInt(v) % 10000n === 0n));
const integerId = z.string().regex(/^[1-9][0-9]{0,77}$/);
const reason = z.string().min(20).max(2000);
const statementSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("evidence-withdrawal"),
      bundleId: hash,
      version: z.number().int().positive(),
      reason,
    })
    .strict(),
  z
    .object({
      kind: z.literal("claim-response"),
      claimId: integerId,
      accept: z.boolean(),
      reason,
      documents: z.array(documentRef).max(20).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("challenge"),
      reason,
      documents: z.array(documentRef).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("checkout"),
      actualAt: timestamp,
      reason,
      documents: z.array(documentRef).min(1).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("settlement"),
      tenantShare: zeroAmount,
      landlordShare: zeroAmount,
      validUntil: timestamp,
      reason,
    })
    .strict(),
]);
const decisionSchema = z
  .object({
    reasons: z
      .array(
        z
          .object({ claimId: integerId, landlordAmount: zeroAmount, reason })
          .strict(),
      )
      .max(10),
    checkoutApproved: z.boolean().optional(),
    reason,
    documents: z.array(documentRef).max(20),
  })
  .strict();
async function store(
  ctx: Context,
  leaseId: string,
  caseId: string | null,
  kind: string,
  content: Row,
) {
  const id = randomUUID(),
    manifest = {
      schemaVersion: "1.0.0",
      leaseId,
      caseId,
      kind,
      author: ctx.session.wallet,
      createdAt: ctx.now,
      ...content,
    };
  const commitment = newCommitment(manifest);
  await ctx.sql.query(
    "INSERT INTO statements(id,lease_id,case_id,author,kind,manifest,salt,commitment,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      id,
      leaseId,
      caseId,
      ctx.session.wallet,
      kind,
      JSON.stringify(manifest),
      commitment.salt,
      commitment.commitment,
      ctx.now,
    ],
  );
  return { id, manifest, ...commitment, onChain: false };
}
export async function createStatement(
  ctx: Context,
  leaseId: string,
  body: unknown,
) {
  const input = statementSchema.parse(body),
    lease = await leaseAccess(ctx, leaseId);
  if (input.kind === "evidence-withdrawal") {
    const [bundle] = await ctx.sql.query(
      "SELECT * FROM evidence_bundles WHERE lease_id=$1 AND author=$2 AND bundle_id=$3 AND version=$4",
      [leaseId, ctx.session.wallet, input.bundleId, input.version],
    );
    requireThat(
      bundle,
      403,
      "FORBIDDEN",
      "Only the original author may append a withdrawal note.",
    );
    verifyManifest(bundle);
    const saved = await store(ctx, leaseId, bundle.case_id, input.kind, {
      ...input,
      targetCommitment: bundle.commitment,
    });
    return { ...saved, transaction: null };
  }
  const live = await liveLease(ctx, lease);
  requireThat(
    live.chainTime < Number(live.terms.hardEndAt),
    409,
    "DEADLINE_PASSED",
    "Final lease deadline has passed.",
  );
  let args: unknown[] = [],
    name = "",
    caseId: string | null = null;
  let content: Row = input;
  if (input.kind === "claim-response") {
    const claim = live.claims.find((item) => String(item.id) === input.claimId);
    requireThat(
      lease.role === "T",
      403,
      "FORBIDDEN",
      "Only the tenant may respond.",
    );
    requireThat(
      [5, 6].includes(live.phase) &&
        live.chainTime < Number(live.schedule.responseDeadline) &&
        claim &&
        ["0", "2"].includes(String(claim.status)),
      409,
      "INVALID_STATE",
      "This claim cannot be answered now.",
    );
    name = "respondClaim";
    args = [input.claimId, input.accept];
    content = {
      ...input,
      documents: await materialRefs(ctx, leaseId, input.documents),
    };
  } else if (input.kind === "checkout") {
    requireThat(
      live.phase === 2 &&
        input.actualAt <= live.chainTime &&
        input.actualAt >= lease.terms.leaseStartAt,
      409,
      "INVALID_STATE",
      "Checkout date or stage is invalid.",
    );
    content = {
      ...input,
      documents: await materialRefs(ctx, leaseId, input.documents),
    };
    name = "requestCheckout";
  } else if (input.kind === "challenge") {
    requireThat(
      live.activeCase.exists &&
        String(live.activeCase.phase) === "2" &&
        live.chainTime < Number(live.activeCase.challengeDeadline),
      409,
      "INVALID_STATE",
      "The challenge window is closed.",
    );
    const [item] = await ctx.sql.query(
      "SELECT id FROM cases WHERE lease_id=$1 AND chain_case_id=$2",
      [leaseId, String(live.activeCase.caseId)],
    );
    requireThat(
      item,
      409,
      "SYNC_REQUIRED",
      "Wait for the current case to synchronize.",
    );
    caseId = item.id;
    content = {
      ...input,
      documents: await materialRefs(ctx, leaseId, input.documents, caseId!),
    };
    name = "challenge";
    args = [String(live.activeCase.caseId)];
  } else {
    requireThat(
      BigInt(live.accounting.fundedAmount) > 0n &&
        BigInt(live.accounting.unallocated) > 0n &&
        BigInt(input.tenantShare) + BigInt(input.landlordShare) ===
          BigInt(live.accounting.unallocated) &&
        input.validUntil > live.chainTime &&
        input.validUntil <= Number(live.terms.hardEndAt) &&
        (!Number(live.activeCase.timeoutAt) ||
          input.validUntil <= Number(live.activeCase.timeoutAt)),
      409,
      "STALE_PROPOSAL",
      "Settlement must cover the current unallocated amount within the fixed deadline.",
    );
    content = { ...input, snapshotRevision: live.accounting.revision };
    name = "proposeSettlement";
    args = [
      input.tenantShare,
      input.landlordShare,
      String(live.accounting.revision),
      String(input.validUntil),
    ];
  }
  const saved = await store(ctx, leaseId, caseId, input.kind, content);
  return {
    ...saved,
    transaction: {
      functionName: name,
      args: [...args, saved.commitment],
      requiresWalletConfirmation: true,
    },
  };
}
export async function createDecision(
  ctx: Context,
  caseId: string,
  body: unknown,
) {
  const input = decisionSchema.parse(body),
    { lease, item, live } = await caseAccess(ctx, caseId);
  requireThat(
    ["R", "F"].includes(lease.role) && live,
    403,
    "FORBIDDEN",
    "Only the assigned resolver may prepare a decision.",
  );
  const c = live.activeCase;
  const canPropose =
    lease.role === "R" &&
    String(c.phase) === "1" &&
    live.chainTime >= Number(c.evidenceDeadline) &&
    live.chainTime < Number(c.primaryDeadline);
  const canResolve =
    lease.role === "F" &&
    String(c.phase) === "3" &&
    live.chainTime >=
      Number(c.fallbackStartAt) + Number(live.terms.timing.fallbackEvidence) &&
    live.chainTime < Number(c.fallbackDeadline);
  requireThat(
    (canPropose || canResolve) && live.chainTime < Number(live.terms.hardEndAt),
    409,
    "INVALID_STATE",
    "A decision is not permitted at this time.",
  );
  const checkout = String(c.caseType) === "1";
  let result: unknown;
  if (checkout) {
    requireThat(
      typeof input.checkoutApproved === "boolean" && input.reasons.length === 0,
      422,
      "INVALID_DECISION",
      "Checkout decisions must contain only a yes/no result.",
    );
    result = input.checkoutApproved;
  } else {
    requireThat(
      input.checkoutApproved === undefined,
      422,
      "INVALID_DECISION",
      "Claims decisions cannot contain a checkout result.",
    );
    const unresolved = live.claims.filter((claim) =>
      ["0", "2"].includes(String(claim.status)),
    );
    requireThat(
      unresolved.length > 0 &&
        input.reasons.length === unresolved.length &&
        input.reasons.every(
          (entry, i) =>
            entry.claimId === String(unresolved[i].id) &&
            BigInt(entry.landlordAmount) <= BigInt(unresolved[i].amount),
        ),
      422,
      "INVALID_DECISION",
      "Decision must cover every disputed claim in order and within its amount.",
    );
    result = input.reasons.map((r) => ({
      claimId: r.claimId,
      landlordAmount: r.landlordAmount,
    }));
  }
  const saved = await store(ctx, lease.id, caseId, "decision", {
    ...input,
    role: lease.role,
    chainCaseId: item.chain_case_id,
    snapshotRevision: live.accounting.revision,
    documents: await materialRefs(ctx, lease.id, input.documents, caseId),
  });
  const name =
    lease.role === "R"
      ? checkout
        ? "proposeCheckoutDecision"
        : "proposeDecision"
      : checkout
        ? "resolveFallbackCheckout"
        : "resolveFallback";
  return {
    ...saved,
    transaction: {
      functionName: name,
      args: [item.chain_case_id, result, saved.commitment],
      requiresWalletConfirmation: true,
    },
  };
}
