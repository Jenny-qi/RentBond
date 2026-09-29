import { randomUUID } from "node:crypto";
import type { Context } from "./context.ts";
import type { Row } from "./db.ts";
import {
  uploadSchema,
  submitSchema,
  bundleSchema,
  claimsSchema,
  type documentRef,
} from "./schemas.ts";
import {
  caseAccess,
  evidenceWindow,
  leaseAccess,
  liveLease,
  scopeAccess,
  verifyManifest,
} from "./acl.ts";
import { newCommitment, randomToken, sha256 } from "./crypto.ts";
import { requireThat } from "./errors.ts";
import { boundedBody, detectMime } from "./storage.ts";
import { audit } from "./auth.ts";
import { caseMaterialRefs } from "./presentation.ts";
import type { z } from "zod";

async function writeAccess(
  ctx: Context,
  leaseId: string,
  caseId: string | undefined,
  purpose: string,
) {
  const lease = await scopeAccess(ctx, leaseId, caseId);
  requireThat(
    ["T", "L"].includes(lease.role),
    403,
    "FORBIDDEN",
    "Only the parties may upload materials.",
  );
  if (caseId) await evidenceWindow(ctx, caseId);
  else if (lease.contract_address) {
    const live = await liveLease(ctx, lease);
    requireThat(
      BigInt(live.accounting.fundedAmount) > 0n &&
        live.phase !== 11 &&
        live.chainTime < Number(live.terms.hardEndAt),
      409,
      "LEASE_NOT_ACTIVE",
      "The lease is not open for new materials.",
    );
  } else
    requireThat(
      purpose === "terms" && !lease.prepared_at,
      409,
      "LEASE_NOT_ACTIVE",
      "Only draft terms may be uploaded before deployment.",
    );
  return lease;
}
export async function uploadIntent(ctx: Context, body: unknown) {
  const input = uploadSchema.parse(body);
  requireThat(
    (input.purpose === "case") === !!input.caseId,
    422,
    "INVALID_INPUT",
    "Case uploads require a case ID.",
  );
  await writeAccess(ctx, input.leaseId, input.caseId, input.purpose);
  // Count both immutable originals and unexpired reservations inside the serialized transaction.
  const [usage] = await ctx.sql.query(
    "SELECT COALESCE((SELECT SUM(v.size) FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.lease_id=$1),0) + COALESCE((SELECT SUM(u.expected_size) FROM document_uploads u JOIN documents d ON d.id=u.document_id WHERE d.lease_id=$1 AND u.submitted_at IS NULL AND u.expires_at > $2),0) AS bytes",
    [input.leaseId, ctx.now],
  );
  requireThat(
    Number(usage.bytes) + input.size <= 104857600,
    422,
    "STORAGE_QUOTA",
    "This lease has reached its 100 MB file limit.",
  );
  let document: Row;
  if (input.documentId) {
    [document] = await ctx.sql.query(
      "SELECT * FROM documents WHERE id=$1 FOR UPDATE",
      [input.documentId],
    );
    requireThat(
      document &&
        document.lease_id === input.leaseId &&
        document.author === ctx.session.wallet &&
        (document.case_id ?? undefined) === input.caseId &&
        document.purpose === input.purpose,
      403,
      "FORBIDDEN",
      "This document cannot be versioned by this account.",
    );
  } else {
    const id = randomUUID();
    [document] = await ctx.sql.query(
      "INSERT INTO documents(id,lease_id,case_id,author,purpose) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [
        id,
        input.leaseId,
        input.caseId ?? null,
        ctx.session.wallet,
        input.purpose,
      ],
    );
  }
  const uploadId = randomUUID(),
    storageKey = input.leaseId + "/" + randomUUID();
  const version = document.next_version,
    expiresAt = ctx.now + 15 * 60000;
  await ctx.sql.query(
    "UPDATE documents SET next_version=next_version+1 WHERE id=$1",
    [document.id],
  );
  await ctx.sql.query(
    "INSERT INTO document_uploads(id,document_id,version,storage_key,expected_size,mime,expected_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      uploadId,
      document.id,
      version,
      storageKey,
      input.size,
      input.mime,
      input.sha256,
      expiresAt,
    ],
  );
  return {
    documentId: document.id,
    version,
    uploadId,
    expiresAt,
    method: "PUT",
    uploadUrl: "/api/documents/" + document.id + "/uploads/" + uploadId,
  };
}
export async function receiveUpload(
  ctx: Context,
  documentId: string,
  uploadId: string,
  request: Request,
) {
  const [row] = await ctx.sql.query(
    "SELECT u.*,d.lease_id,d.case_id,d.author,d.purpose FROM document_uploads u JOIN documents d ON d.id=u.document_id WHERE u.id=$1 AND d.id=$2",
    [uploadId, documentId],
  );
  requireThat(
    row && row.author === ctx.session.wallet,
    403,
    "FORBIDDEN",
    "Upload is not assigned to this account.",
  );
  await writeAccess(ctx, row.lease_id, row.case_id ?? undefined, row.purpose);
  requireThat(
    !row.uploaded_at && !row.submitted_at && Number(row.expires_at) > ctx.now,
    409,
    "UPLOAD_EXPIRED",
    "Upload was used or expired.",
  );
  const bytes = await boundedBody(request, Number(row.expected_size));
  requireThat(
    bytes.length === row.expected_size &&
      detectMime(bytes) === row.mime &&
      sha256(bytes) === row.expected_hash,
    422,
    "FILE_MISMATCH",
    "File size, type or digest does not match the upload intent.",
  );
  requireThat(
    await ctx.app.storage.health(),
    503,
    "STORAGE_UNAVAILABLE",
    "Private storage is not correctly configured.",
  );
  try {
    await ctx.app.storage.put(row.storage_key, bytes, row.mime);
  } catch (error) {
    // A previous upload may have reached storage before its database commit/HTTP response failed.
    const existing = await ctx.app.storage
      .get(row.storage_key)
      .catch(() => null);
    if (
      !existing ||
      sha256(existing) !== row.expected_hash ||
      existing.length !== row.expected_size
    )
      throw error;
  }
  await ctx.sql.query(
    "UPDATE document_uploads SET uploaded_at=$1 WHERE id=$2",
    [ctx.now, uploadId],
  );
  return { documentId, version: row.version, uploaded: true, submitted: false };
}
export async function submitDocument(
  ctx: Context,
  documentId: string,
  body: unknown,
) {
  const { uploadId } = submitSchema.parse(body);
  const [row] = await ctx.sql.query(
    "SELECT u.*,d.lease_id,d.case_id,d.author,d.purpose FROM document_uploads u JOIN documents d ON d.id=u.document_id WHERE u.id=$1 AND d.id=$2",
    [uploadId, documentId],
  );
  requireThat(
    row && row.author === ctx.session.wallet,
    403,
    "FORBIDDEN",
    "This upload belongs to another account.",
  );
  await writeAccess(ctx, row.lease_id, row.case_id ?? undefined, row.purpose);
  requireThat(
    row.uploaded_at && !row.submitted_at && Number(row.expires_at) > ctx.now,
    409,
    "UPLOAD_EXPIRED",
    "Upload is missing, expired or already submitted.",
  );
  const bytes = await ctx.app.storage.get(row.storage_key);
  requireThat(
    bytes.length === row.expected_size &&
      detectMime(bytes) === row.mime &&
      sha256(bytes) === row.expected_hash,
    409,
    "COMMITMENT_MISMATCH",
    "Stored file differs from its upload commitment.",
  );
  await ctx.sql.query(
    "INSERT INTO document_versions(document_id,version,storage_key,content_hash,size,mime,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      documentId,
      row.version,
      row.storage_key,
      row.expected_hash,
      row.expected_size,
      row.mime,
      ctx.now,
    ],
  );
  await ctx.sql.query(
    "UPDATE document_uploads SET submitted_at=$1 WHERE id=$2",
    [ctx.now, uploadId],
  );
  await audit(
    ctx.sql,
    ctx.session.wallet,
    "document.submit",
    documentId,
    ctx.now,
    ctx.requestId,
  );
  return {
    documentId,
    version: row.version,
    sha256: row.expected_hash,
    submittedAt: ctx.now,
    onChain: false,
  };
}
export async function documentAccess(
  ctx: Context,
  id: string,
  version: number,
  caseId?: string,
): Promise<Row> {
  const [row] = await ctx.sql.query(
    "SELECT v.*,d.lease_id,d.case_id,d.author,d.purpose FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE v.document_id=$1 AND v.version=$2",
    [id, version],
  );
  requireThat(row, 403, "FORBIDDEN", "You cannot access this document.");
  const lease = await scopeAccess(
    ctx,
    row.lease_id,
    caseId ?? row.case_id ?? undefined,
  );
  if (lease.contract_address && ["T", "L"].includes(lease.role))
    await liveLease(ctx, lease);
  if (row.case_id)
    requireThat(
      !caseId || caseId === row.case_id,
      403,
      "FORBIDDEN",
      "Document belongs to another case.",
    );
  if (!["T", "L"].includes(lease.role) && !row.case_id) {
    requireThat(caseId, 403, "FORBIDDEN", "A case scope is required.");
    const refs = await caseMaterialRefs(ctx, row.lease_id, caseId);
    const referenced = refs.some(
      (ref) => ref.documentId === id && ref.version === version,
    );
    requireThat(
      referenced,
      403,
      "FORBIDDEN",
      "This document was not submitted to your case.",
    );
  }
  return row;
}
export async function issueAccess(
  ctx: Context,
  type: "document" | "export",
  id: string,
  version?: number,
  caseId?: string,
) {
  const token = randomToken(),
    expiresAt = ctx.now + 300000;
  await ctx.sql.query(
    "INSERT INTO access_grants(token_hash,session_hash,resource_type,resource_id,version,case_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      sha256(token),
      ctx.session.hash,
      type,
      id,
      version ?? null,
      caseId ?? null,
      expiresAt,
    ],
  );
  await audit(
    ctx.sql,
    ctx.session.wallet,
    type + ".access",
    id,
    ctx.now,
    ctx.requestId,
  );
  return { url: "/api/files/" + token, expiresAt };
}
export async function materialRefs(
  ctx: Context,
  leaseId: string,
  refs: z.infer<typeof documentRef>[],
  caseId?: string,
) {
  const result: Row[] = [];
  for (const ref of refs) {
    const row = await documentAccess(ctx, ref.documentId, ref.version, caseId);
    requireThat(
      row.lease_id === leaseId && (!row.case_id || row.case_id === caseId),
      403,
      "FORBIDDEN",
      "Material reference belongs to another lease or case.",
    );
    const bytes = await ctx.app.storage.get(row.storage_key);
    requireThat(
      sha256(bytes) === row.content_hash,
      409,
      "COMMITMENT_MISMATCH",
      "A referenced file was modified.",
    );
    result.push({
      ...ref,
      sha256: row.content_hash,
      size: row.size,
      mime: row.mime,
    });
  }
  return result;
}
export async function createBundle(
  ctx: Context,
  body: unknown,
  caseId?: string,
) {
  const input = bundleSchema.parse(body);
  requireThat(
    (input.stage === "case") === !!caseId,
    422,
    "INVALID_INPUT",
    "Case material requires a case endpoint.",
  );
  if (caseId) {
    const result = await evidenceWindow(ctx, caseId);
    requireThat(
      result.lease.id === input.leaseId,
      403,
      "FORBIDDEN",
      "Case belongs to another lease.",
    );
  } else await writeAccess(ctx, input.leaseId, undefined, input.stage);
  const bundleId = input.bundleId ?? "0x" + randomToken();
  const [last] = await ctx.sql.query(
    "SELECT * FROM evidence_bundles WHERE lease_id=$1 AND author=$2 AND bundle_id=$3 ORDER BY version DESC LIMIT 1",
    [input.leaseId, ctx.session.wallet, bundleId],
  );
  requireThat(
    !last || (last.case_id ?? undefined) === caseId,
    409,
    "INVALID_VERSION",
    "Bundle scope cannot change.",
  );
  const version = last ? last.version + 1 : 1;
  const items: Row[] = [];
  for (const item of input.items)
    items.push({
      ...item,
      documents: await materialRefs(ctx, input.leaseId, item.documents, caseId),
    });
  const manifest = {
    schemaVersion: "1.0.0",
    leaseId: input.leaseId,
    caseId: caseId ?? null,
    stage: input.stage,
    bundleId,
    version,
    author: ctx.session.wallet,
    submittedAt: ctx.now,
    items,
  };
  const commitment = newCommitment(manifest),
    id = randomUUID();
  await ctx.sql.query(
    "INSERT INTO evidence_bundles(id,lease_id,case_id,author,bundle_id,version,manifest,salt,commitment,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      id,
      input.leaseId,
      caseId ?? null,
      ctx.session.wallet,
      bundleId,
      version,
      JSON.stringify(manifest),
      commitment.salt,
      commitment.commitment,
      ctx.now,
    ],
  );
  return {
    id,
    manifest,
    ...commitment,
    acknowledged: false,
    onChain: false,
    transaction: {
      functionName: "recordEvidence",
      args: [bundleId, String(version), commitment.commitment],
      requiresWalletConfirmation: true,
    },
  };
}
export async function createClaims(ctx: Context, body: unknown) {
  const input = claimsSchema.parse(body),
    lease = await leaseAccess(ctx, input.leaseId, ["L"]);
  const live = await liveLease(ctx, lease);
  requireThat(
    live.phase === 5 &&
      live.claims.length === 0 &&
      live.chainTime < Number(live.schedule.claimDeadline) &&
      live.chainTime < Number(live.terms.hardEndAt),
    409,
    "CLAIMS_WINDOW_CLOSED",
    "Claims cannot be submitted at this stage.",
  );
  requireThat(
    input.items.reduce((sum, item) => sum + BigInt(item.amount), 0n) <=
      BigInt(live.terms.depositAmount),
    422,
    "CLAIMS_EXCEED_DEPOSIT",
    "Claims exceed the deposit.",
  );
  const items: Row[] = [];
  for (const [index, item] of input.items.entries()) {
    const manifest = {
      schemaVersion: "1.0.0",
      leaseId: lease.id,
      claimId: String(index + 1),
      ...item,
      documents: await materialRefs(ctx, lease.id, item.documents),
    };
    items.push({ manifest, ...newCommitment(manifest) });
  }
  const manifest = { schemaVersion: "1.0.0", leaseId: lease.id, items },
    commitment = newCommitment(manifest),
    id = randomUUID();
  await ctx.sql.query(
    "INSERT INTO claim_drafts(id,lease_id,author,manifest,salt,commitment,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      lease.id,
      ctx.session.wallet,
      JSON.stringify(manifest),
      commitment.salt,
      commitment.commitment,
      ctx.now,
    ],
  );
  return {
    id,
    manifest,
    ...commitment,
    onChain: false,
    transaction: {
      functionName: "submitClaims",
      args: [
        items.map((item) => ({
          amount: item.manifest.amount,
          commitment: item.commitment,
        })),
      ],
      requiresWalletConfirmation: true,
    },
  };
}
