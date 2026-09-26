import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { App, Context } from "./context.ts";
import type { Row } from "./db.ts";
import { ApiFailure, requireThat } from "./errors.ts";
import {
  enforceOrigin,
  issueNonce,
  verifyLogin,
  getSession,
  cookie,
  cookieName,
  cookieValue,
  clientScope,
  rateLimit,
  audit,
} from "./auth.ts";
import { canonicalJson, seal, unseal, sha256 } from "./crypto.ts";
import { boundedBody } from "./storage.ts";
import { loginSchema, uuid, hash, claimInvite } from "./schemas.ts";
import {
  createDraft,
  updateDraft,
  createInvite,
  acceptInvite,
  prepareDraft,
  checkedProfile,
} from "./leases.ts";
import { leaseAccess, caseAccess, scopeAccess, verifyManifest } from "./acl.ts";
import {
  uploadIntent,
  receiveUpload,
  submitDocument,
  documentAccess,
  issueAccess,
  createBundle,
  createClaims,
} from "./documents.ts";
import { createExport, exportAccess, requestGas } from "./jobs.ts";
import { attachDeployment } from "./projections.ts";
import { createDecision, createStatement } from "./statements.ts";
import { privateHistory, evidenceStatus } from "./presentation.ts";

interface Reply {
  data: unknown;
  status?: number;
  cookies?: string[];
}
const privateHeaders = {
  "cache-control": "no-store, private",
  vary: "Cookie",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
function respond(reply: Reply, requestId: string) {
  const headers = new Headers({
    ...privateHeaders,
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
  });
  for (const value of reply.cookies ?? []) headers.append("set-cookie", value);
  return new Response(JSON.stringify(reply.data), {
    status: reply.status ?? 200,
    headers,
  });
}
async function bodyJson(request: Request) {
  requireThat(
    request.headers.get("content-type")?.split(";")[0] === "application/json",
    415,
    "CONTENT_TYPE",
    "Send application/json.",
  );
  try {
    return JSON.parse(
      Buffer.from(await boundedBody(request, 256 * 1024)).toString("utf8"),
    );
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw new ApiFailure(422, "INVALID_JSON", "Invalid JSON body.");
  }
}
function publicExport(job: Row) {
  return {
    id: job.id,
    state: job.state,
    attempts: job.attempts,
    errorCode: job.error_code,
    createdAt: Number(job.created_at),
    completedAt: job.completed_at ? Number(job.completed_at) : null,
  };
}
async function replayAccess(ctx: Context, path: string[], body: Row) {
  if (path[0] === "leases" && path[1] !== "drafts" && path[1])
    await leaseAccess(
      ctx,
      uuid.parse(path[1]),
      ["statements", "cleanup-request"].includes(path[2]) ? ["T", "L"] : ["L"],
    );
  if (path[0] === "leases" && path[1] === "drafts" && path[2])
    await leaseAccess(ctx, uuid.parse(path[2]), ["L"]);
  if (body.leaseId) {
    if (path[0] === "test-gas")
      await leaseAccess(ctx, uuid.parse(body.leaseId), ["T", "L", "R", "F"]);
    else
      await scopeAccess(
        ctx,
        uuid.parse(body.leaseId),
        body.caseId ? uuid.parse(body.caseId) : undefined,
      );
  }
  if (path[0] === "cases") await caseAccess(ctx, uuid.parse(path[1]));
  if (path[0] === "documents" && path[1] !== "upload-intent") {
    const [doc] = await ctx.sql.query("SELECT * FROM documents WHERE id=$1", [
      uuid.parse(path[1]),
    ]);
    requireThat(
      doc && doc.author === ctx.session.wallet,
      403,
      "FORBIDDEN",
      "Document is not assigned to this account.",
    );
    await scopeAccess(ctx, doc.lease_id, doc.case_id ?? undefined);
  }
}
async function dispatch(
  ctx: Context,
  request: Request,
  path: string[],
  body: unknown,
  url: URL,
): Promise<Reply | Response> {
  const method = request.method,
    key = method + " /" + path.join("/");
  if (key === "GET /auth/session")
    return {
      data: { wallet: ctx.session.wallet, expiresAt: ctx.session.expiresAt },
    };
  if (key === "GET /leases") {
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .parse(url.searchParams.get("limit") ?? 20);
    const cursor = url.searchParams.get("cursor");
    if (cursor) uuid.parse(cursor);
    const rows = await ctx.sql.query(
      "SELECT l.id,l.terms,l.contract_address,l.commitment,l.version,l.synced_at,l.projection,m.role FROM leases l JOIN lease_members m ON l.id=m.lease_id WHERE m.wallet=$1 AND m.role IN ('T','L') AND ($2::uuid IS NULL OR l.id > $2) ORDER BY l.id LIMIT $3",
      [ctx.session.wallet, cursor, limit + 1],
    );
    return {
      data: {
        items: rows.slice(0, limit).map((r) => ({
          id: r.id,
          title: r.terms.title,
          role: r.role,
          version: r.version,
          contractAddress: r.contract_address,
          commitment: r.commitment,
          projection: r.projection,
          lastSyncedAt: r.synced_at,
        })),
        nextCursor: rows.length > limit ? rows[limit - 1].id : null,
      },
    };
  }
  if (key === "POST /leases/drafts")
    return { data: await createDraft(ctx, body), status: 201 };
  if (path[0] === "leases" && path[1] === "drafts" && path[2]) {
    const id = uuid.parse(path[2]);
    if (method === "PATCH" && path.length === 3)
      return { data: await updateDraft(ctx, id, body) };
    if (method === "POST" && path.length === 4 && path[3] === "prepare")
      return { data: await prepareDraft(ctx, id, body) };
  }
  if (path[0] === "leases" && path[1] && path[1] !== "drafts") {
    const id = uuid.parse(path[1]);
    if (method === "POST" && path.length === 3 && path[2] === "invites")
      return { data: await createInvite(ctx, id, body), status: 201 };
    if (method === "POST" && path.length === 3 && path[2] === "deployment")
      return { data: await attachDeployment(ctx, id, body) };
    if (method === "POST" && path.length === 3 && path[2] === "statements")
      return { data: await createStatement(ctx, id, body), status: 201 };
    if (
      method === "POST" &&
      path.length === 3 &&
      path[2] === "cleanup-request"
    ) {
      z.object({ confirm: z.literal(true) })
        .strict()
        .parse(body);
      await leaseAccess(ctx, id);
      await audit(
        ctx.sql,
        ctx.session.wallet,
        "retention.request",
        id,
        ctx.now,
        ctx.requestId,
      );
      return {
        data: { leaseId: id, requested: true, deleted: false },
        status: 202,
      };
    }
    if (method === "GET" && path.length === 2) {
      const lease = await leaseAccess(ctx, id);
      const bundles = await ctx.sql.query(
        "SELECT id,manifest,salt,commitment FROM evidence_bundles WHERE lease_id=$1 ORDER BY created_at,id",
        [id],
      );
      bundles.forEach(verifyManifest);
      const documents = await ctx.sql.query(
        "SELECT d.id,d.purpose,d.case_id,d.author,v.version,v.content_hash,v.size,v.mime,v.submitted_at FROM documents d JOIN document_versions v ON v.document_id=d.id WHERE d.lease_id=$1 ORDER BY d.id,v.version",
        [id],
      );
      const cases = await ctx.sql.query(
        "SELECT id,chain_case_id,snapshot,synced_at FROM cases WHERE lease_id=$1",
        [id],
      );
      const history = await privateHistory(ctx, id);
      return {
        data: {
          id,
          role: lease.role,
          version: lease.version,
          terms: lease.terms,
          salt: lease.salt,
          commitment: lease.commitment,
          frozen: !!lease.prepared_at,
          contractAddress: lease.contract_address,
          projection: lease.projection,
          lastSyncedAt: lease.synced_at,
          bundles: await Promise.all(
            bundles.map((b) => evidenceStatus(ctx, lease, b, history.events)),
          ),
          documents,
          cases,
          ...history,
        },
      };
    }
  }
  if (
    path[0] === "invites" &&
    path.length === 3 &&
    path[2] === "claim" &&
    method === "POST"
  ) {
    requireThat(
      /^[a-f0-9]{64}$/.test(path[1]),
      403,
      "FORBIDDEN",
      "Invalid invitation.",
    );
    claimInvite.parse(body);
    return { data: await acceptInvite(ctx, path[1]) };
  }
  if (path[0] === "invites" && path.length === 2 && method === "GET") {
    const [invite] = await ctx.sql.query(
      "SELECT i.*,l.terms,l.tenant FROM invites i JOIN leases l ON l.id=i.lease_id WHERE i.token_hash=$1 AND i.expires_at>$2 AND i.claimed_at IS NULL",
      [sha256(path[1]), ctx.now],
    );
    requireThat(
      invite && !invite.tenant,
      403,
      "FORBIDDEN",
      "Invitation is unavailable.",
    );
    return {
      data: {
        leaseId: invite.lease_id,
        depositAmount: invite.terms.depositAmount,
        leaseEndAt: invite.terms.leaseEndAt,
        expiresAt: Number(invite.expires_at),
        walletMatches:
          !invite.expected_wallet ||
          invite.expected_wallet === ctx.session.wallet,
        testAsset: "MockUSD",
      },
    };
  }
  if (key === "POST /documents/upload-intent")
    return { data: await uploadIntent(ctx, body), status: 201 };
  if (path[0] === "documents" && path[1] && path[1] !== "upload-intent") {
    const id = uuid.parse(path[1]);
    if (path.length === 4 && path[2] === "uploads" && method === "PUT") {
      return {
        data: await receiveUpload(ctx, id, uuid.parse(path[3]), request),
      };
    }
    if (path.length === 3 && path[2] === "submit" && method === "POST")
      return { data: await submitDocument(ctx, id, body), status: 201 };
    if (path.length === 3 && path[2] === "access" && method === "GET") {
      const version = z.coerce
        .number()
        .int()
        .positive()
        .parse(url.searchParams.get("version"));
      const caseId = url.searchParams.get("caseId") ?? undefined;
      if (caseId) uuid.parse(caseId);
      await documentAccess(ctx, id, version, caseId);
      return { data: await issueAccess(ctx, "document", id, version, caseId) };
    }
  }
  if (key === "POST /inspections")
    return { data: await createBundle(ctx, body), status: 201 };
  if (key === "POST /claims/draft")
    return { data: await createClaims(ctx, body), status: 201 };
  if (path[0] === "cases" && path[1]) {
    const id = uuid.parse(path[1]);
    if (method === "POST" && path.length === 3 && path[2] === "evidence")
      return { data: await createBundle(ctx, body, id), status: 201 };
    if (method === "POST" && path.length === 3 && path[2] === "decisions")
      return { data: await createDecision(ctx, id, body), status: 201 };
    if (method === "GET" && path.length === 2) {
      const { lease, item, live } = await caseAccess(ctx, id);
      const bundles = await ctx.sql.query(
        "SELECT id,manifest,salt,commitment FROM evidence_bundles WHERE case_id=$1",
        [id],
      );
      bundles.forEach(verifyManifest);
      const history = await privateHistory(ctx, lease.id, id);
      return {
        data: {
          id,
          leaseId: lease.id,
          terms: lease.terms,
          commitment: lease.commitment,
          salt: lease.salt,
          snapshot: live?.activeCase ?? item.snapshot,
          lastSyncedAt: item.synced_at,
          bundles: await Promise.all(
            bundles.map((b) => evidenceStatus(ctx, lease, b, history.events)),
          ),
          ...history,
        },
      };
    }
  }
  if (key === "GET /resolver/cases") {
    const rows = await ctx.sql.query(
      "SELECT c.id FROM cases c JOIN lease_members m ON c.lease_id=m.lease_id WHERE m.wallet=$1 AND m.role IN ('R','F') ORDER BY c.id",
      [ctx.session.wallet],
    );
    const items = [];
    for (const row of rows) {
      try {
        const { lease, item, live } = await caseAccess(ctx, row.id);
        items.push({
          id: row.id,
          leaseId: lease.id,
          role: lease.role,
          snapshot: live?.activeCase ?? item.snapshot,
        });
      } catch (error) {
        if (!(error instanceof ApiFailure) || error.status !== 403) throw error;
      }
    }
    return { data: { items } };
  }
  if (key === "GET /resolver/profiles") {
    const candidates = await ctx.sql.query(
      "SELECT id FROM service_profiles WHERE reviewed=true AND chain_id=$1 ORDER BY id",
      [ctx.app.config.chainId],
    );
    const items = [];
    for (const candidate of candidates) {
      try {
        const { stored, profile } = await checkedProfile(ctx, candidate.id);
        items.push({
          id: stored.id,
          manifest: stored.manifest,
          salt: stored.salt,
          commitment: stored.commitment,
          profile,
          testService: true,
        });
      } catch (error) {
        if (!(error instanceof ApiFailure) || error.status !== 409) throw error;
      }
    }
    return { data: { items } };
  }
  if (key === "POST /exports")
    return { data: await createExport(ctx, body), status: 202 };
  if (path[0] === "exports" && path[1] && method === "GET") {
    const job = await exportAccess(ctx, uuid.parse(path[1]));
    if (path.length === 2) return { data: publicExport(job) };
    if (path.length === 3 && path[2] === "access") {
      requireThat(
        job.state === "ready",
        409,
        "EXPORT_NOT_READY",
        "Export is not ready.",
      );
      return {
        data: await issueAccess(
          ctx,
          "export",
          job.id,
          undefined,
          job.case_id ?? undefined,
        ),
      };
    }
  }
  if (key === "POST /test-gas/request")
    return { data: await requestGas(ctx, body), status: 202 };
  if (
    path[0] === "test-gas" &&
    path[1] === "requests" &&
    path.length === 3 &&
    method === "GET"
  ) {
    const [job] = await ctx.sql.query(
      "SELECT id,lease_id,state,amount,tx_hash,attempts,error_code,gas_used,effective_gas_price FROM test_gas_requests WHERE id=$1 AND wallet=$2",
      [uuid.parse(path[2]), ctx.session.wallet],
    );
    requireThat(job, 403, "FORBIDDEN", "You cannot access this request.");
    await leaseAccess(ctx, job.lease_id, ["T", "L", "R", "F"]);
    return { data: job };
  }
  if (path[0] === "transactions" && path.length === 2 && method === "GET") {
    const txHash = hash.parse(path[1]);
    const transaction = await ctx.app.chain.transaction(txHash);
    const allowed = await ctx.sql.query(
      "SELECT l.id FROM leases l JOIN lease_members m ON m.lease_id=l.id WHERE l.contract_address=$1 AND m.wallet=$2",
      [transaction.to, ctx.session.wallet],
    );
    const factoryOwn =
      transaction.to === ctx.app.config.factoryAddress?.toLowerCase() &&
      transaction.from === ctx.session.wallet;
    requireThat(
      allowed.length || factoryOwn,
      403,
      "FORBIDDEN",
      "Transaction is not for an authorized contract.",
    );
    return { data: transaction };
  }
  if (path[0] === "files" && path.length === 2 && method === "GET") {
    const [grant] = await ctx.sql.query(
      "SELECT * FROM access_grants WHERE token_hash=$1 AND session_hash=$2 AND expires_at > $3",
      [sha256(path[1]), ctx.session.hash, ctx.now],
    );
    requireThat(
      grant,
      403,
      "FORBIDDEN",
      "File link expired or belongs to another session.",
    );
    let key: string, digest: string, mime: string, filename: string;
    if (grant.resource_type === "document") {
      const version = await documentAccess(
        ctx,
        grant.resource_id,
        grant.version,
        grant.case_id ?? undefined,
      );
      key = version.storage_key;
      digest = version.content_hash;
      mime = version.mime;
      filename =
        version.document_id +
        "-v" +
        version.version +
        (mime === "application/pdf"
          ? ".pdf"
          : mime === "image/png"
            ? ".png"
            : ".jpg");
    } else {
      const job = await exportAccess(ctx, grant.resource_id);
      requireThat(
        job.state === "ready",
        409,
        "EXPORT_NOT_READY",
        "Export is not available.",
      );
      key = job.storage_key;
      digest = job.content_hash;
      mime = "application/zip";
      filename = job.id + ".zip";
    }
    const bytes = await ctx.app.storage.get(key);
    requireThat(
      sha256(bytes) === digest,
      409,
      "COMMITMENT_MISMATCH",
      "Stored file differs from its recorded digest.",
    );
    await audit(
      ctx.sql,
      ctx.session.wallet,
      "file.download",
      grant.resource_id,
      ctx.now,
      ctx.requestId,
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        ...privateHeaders,
        "content-type": mime,
        "content-length": String(bytes.length),
        "content-disposition": 'attachment; filename="' + filename + '"',
        "content-security-policy": "sandbox; default-src 'none'",
        "cross-origin-resource-policy": "same-origin",
        "x-request-id": ctx.requestId,
      },
    });
  }
  throw new ApiFailure(404, "NOT_FOUND", "Endpoint not found.");
}

export async function handleApi(app: App, request: Request): Promise<Response> {
  const requestId = randomUUID(),
    now = app.now();
  try {
    enforceOrigin(request, app.config);
    const url = new URL(request.url);
    requireThat(
      url.pathname.startsWith("/api/"),
      404,
      "NOT_FOUND",
      "Endpoint not found.",
    );
    const path = url.pathname
      .slice(5)
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    if (path.join("/") === "health" && request.method === "GET") {
      const db = await app.db.query("SELECT 1 AS ready").then(
        () => true,
        () => false,
      );
      const storage = await app.storage.health().catch(() => false);
      const rpc = app.config.rpcUrl
        ? await app.chain.health().catch(() => false)
        : null;
      return respond(
        {
          data: { database: db, storage, rpc: rpc ?? "not_configured" },
          status: db && storage && rpc !== false ? 200 : 503,
        },
        requestId,
      );
    }
    const scope = clientScope(request, app.config);
    if (path.join("/") === "auth/nonce" && request.method === "GET") {
      await rateLimit(app.db, "nonce:" + scope, now, 30, 60000);
      const nonce = await issueNonce(app.db, app.config, now);
      return respond({ data: nonce.data, cookies: [nonce.cookie] }, requestId);
    }
    if (path.join("/") === "auth/verify" && request.method === "POST") {
      await rateLimit(app.db, "verify:" + scope, now, 30, 60000);
      const login = await verifyLogin(
        app.db,
        app.config,
        request,
        loginSchema.parse(await bodyJson(request)),
        app.now(),
      );
      return respond(login, requestId);
    }
    if (path.join("/") === "auth/logout" && request.method === "POST") {
      const token = cookieValue(request, cookieName(app.config, "session"));
      if (token)
        await app.db.query(
          "UPDATE sessions SET revoked_at=$1 WHERE session_hash=$2",
          [now, sha256(token)],
        );
      return respond(
        {
          data: { loggedOut: true },
          cookies: [
            cookie(app.config, "session", "", 0),
            cookie(app.config, "nonce", "", 0),
          ],
        },
        requestId,
      );
    }
    const session = await getSession(app.db, app.config, request, now);
    await rateLimit(app.db, "account:" + session.wallet, now, 180, 60000);
    const body = ["POST", "PATCH"].includes(request.method)
      ? await bodyJson(request)
      : undefined;
    const reply = await app.db.transaction(async (sql) => {
      const now = app.now();
      // Recheck in the same transaction as the operation, including logout races.
      const current = await getSession(sql, app.config, request, now);
      const ctx: Context = { app, sql, session: current, requestId, now };
      if (request.method !== "POST") {
        const result = await dispatch(ctx, request, path, body, url);
        await audit(
          sql,
          current.wallet,
          "api." + request.method.toLowerCase() + "." + path[0],
          path[1] && /^[a-f0-9-]{36}$/.test(path[1]) ? path[1] : null,
          now,
          requestId,
        );
        return result;
      }
      const key = request.headers.get("idempotency-key");
      requireThat(
        key && /^[A-Za-z0-9_-]{8,128}$/.test(key),
        422,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Supply an Idempotency-Key of 8-128 letters, digits, underscores or hyphens.",
      );
      let canonicalBody: string;
      try {
        canonicalBody = canonicalJson(body);
      } catch {
        throw new ApiFailure(
          422,
          "INVALID_INPUT",
          "Use JSON values and integer amounts.",
        );
      }
      const idScope = sha256(current.hash + ":" + url.pathname + ":" + key),
        bodyHash = sha256(canonicalBody);
      const [previous] = await sql.query(
        "SELECT * FROM idempotency_keys WHERE scope=$1 AND expires_at > $2",
        [idScope, now],
      );
      if (previous) {
        requireThat(
          previous.body_hash === bodyHash,
          409,
          "IDEMPOTENCY_CONFLICT",
          "This key was used with different input.",
        );
        await replayAccess(ctx, path, body as Row);
        return unseal<Reply>(
          previous.response_sealed,
          app.config.sessionSecret,
        );
      }
      const response = await dispatch(ctx, request, path, body, url);
      requireThat(
        !(response instanceof Response),
        500,
        "INTERNAL_ERROR",
        "Invalid command response.",
      );
      await audit(
        sql,
        current.wallet,
        "api.post." + path[0],
        path[1] && /^[a-f0-9-]{36}$/.test(path[1]) ? path[1] : null,
        now,
        requestId,
      );
      await sql.query(
        "INSERT INTO idempotency_keys(scope,body_hash,response_sealed,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(scope) DO UPDATE SET body_hash=EXCLUDED.body_hash,response_sealed=EXCLUDED.response_sealed,expires_at=EXCLUDED.expires_at",
        [
          idScope,
          bodyHash,
          seal(response, app.config.sessionSecret),
          now + 86400000,
        ],
      );
      return response;
    });
    return reply instanceof Response ? reply : respond(reply, requestId);
  } catch (error) {
    let failure: ApiFailure;
    if (error instanceof ApiFailure) failure = error;
    else if (error instanceof z.ZodError || error instanceof URIError)
      failure = new ApiFailure(
        422,
        "INVALID_INPUT",
        "Input does not match the API schema.",
      );
    else if (
      ["23505", "23503"].includes((error as { code?: string }).code ?? "")
    )
      failure = new ApiFailure(
        409,
        "CONCURRENT_MODIFICATION",
        "Resource changed. Reload and retry.",
      );
    else {
      // Never log raw request bodies, signed messages, URLs, database credentials or RPC error details.
      console.error(
        JSON.stringify({
          requestId,
          event: "api.dependency_failure",
          name: (error as Error)?.name ?? "Error",
        }),
      );
      failure = new ApiFailure(
        503,
        "SERVICE_UNAVAILABLE",
        "A required service is unavailable.",
        true,
      );
    }
    return respond(
      {
        status: failure.status,
        data: {
          error: {
            code: failure.code,
            message: failure.message,
            requestId,
            retryable: failure.retryable,
          },
        },
      },
      requestId,
    );
  }
}
