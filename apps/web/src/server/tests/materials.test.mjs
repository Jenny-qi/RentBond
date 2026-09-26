import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { fixture, client, draft, draftBody, upload, png } from "./helpers.mjs";
import { sha256 } from "../crypto.ts";
import { runExportJob } from "../jobs.ts";

test("draft validation, optimistic versioning, idempotency and no client payment state", async (t) => {
  const { app } = await fixture(t),
    l = client(app);
  await l.login();
  const body = draftBody(app),
    key = randomUUID();
  const create = () =>
    l.request("/api/leases/drafts", {
      method: "POST",
      headers: { "idempotency-key": key },
      json: body,
    });
  const [a, b] = await Promise.all([create(), create()]);
  assert.equal(a.status, 201);
  assert.equal(b.data.id, a.data.id);
  assert.equal((await app.db.query("SELECT * FROM leases")).length, 1);
  assert.equal(
    (
      await l.request("/api/leases/drafts", {
        method: "POST",
        headers: { "idempotency-key": key },
        json: { ...body, title: "Changed" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await l.request("/api/leases/drafts", {
        method: "POST",
        json: { ...body, funded: true },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await l.request("/api/leases/drafts", {
        method: "POST",
        json: { ...body, depositAmount: "1.1" },
      })
    ).status,
    422,
  );
  const edit = { version: 1, title: "Changed" };
  const updates = await Promise.all(
    [1, 2].map(() =>
      l.request("/api/leases/drafts/" + a.data.id, {
        method: "PATCH",
        json: edit,
      }),
    ),
  );
  assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await l.request("/api/leases/" + a.data.id)).data.version, 2);
  assert.ok((await l.request("/api/leases?limit=1")).data.items.length === 1);
});

test("invites require the intended wallet, expire, cannot be reused and do not accept terms", async (t) => {
  const f = await fixture(t),
    { app } = f,
    l = client(app),
    tenant = client(app),
    other = client(app);
  await l.login();
  await tenant.login();
  await other.login();
  const id = await draft(app, l);
  const invite = await l.request("/api/leases/" + id + "/invites", {
    method: "POST",
    json: { wallet: tenant.wallet, expiresInSeconds: 60 },
  });
  assert.equal(invite.status, 201);
  const claim = "/api/invites/" + invite.data.token + "/claim";
  assert.equal(
    (await other.request(claim, { method: "POST", json: { confirm: true } }))
      .status,
    403,
  );
  const accepted = await tenant.request(claim, {
    method: "POST",
    json: { confirm: true },
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.termsAccepted, false);
  assert.equal(
    (await tenant.request(claim, { method: "POST", json: { confirm: true } }))
      .status,
    403,
  );
  const stored = (await app.db.query("SELECT * FROM invites"))[0];
  assert.equal(stored.token_hash, sha256(invite.data.token));
  const caches = await app.db.query(
    "SELECT response_sealed FROM idempotency_keys",
  );
  assert.ok(
    caches.every((c) => !c.response_sealed.includes(invite.data.token)),
  );
  const second = await draft(app, l);
  const exp = await l.request("/api/leases/" + second + "/invites", {
    method: "POST",
    json: { wallet: tenant.wallet, expiresInSeconds: 60 },
  });
  f.advance(60000);
  assert.equal(
    (
      await tenant.request("/api/invites/" + exp.data.token + "/claim", {
        method: "POST",
        json: { confirm: true },
      })
    ).status,
    403,
  );
});

test("cross-lease documents, exports, lease details and session-bound short links are denied", async (t) => {
  const f = await fixture(t),
    { app } = f,
    l = client(app),
    tenant = client(app),
    other = client(app);
  await l.login();
  await tenant.login();
  await other.login();
  const id = await draft(app, l, tenant),
    file = await upload(app, l, id);
  assert.equal((await other.request("/api/leases/" + id)).status, 403);
  const access =
    "/api/documents/" + file.documentId + "/access?version=" + file.version;
  assert.equal((await other.request(access)).status, 403);
  assert.equal(
    (
      await other.request("/api/exports", {
        method: "POST",
        json: { leaseId: id },
      })
    ).status,
    403,
  );
  const grant = await tenant.request(access);
  assert.equal(grant.status, 200);
  assert.equal((await other.request(grant.data.url)).status, 403);
  const received = await tenant.request(grant.data.url);
  assert.equal(received.status, 200);
  assert.deepEqual(received.data, png());
  assert.match(
    received.response.headers.get("content-disposition"),
    /^attachment/,
  );
  assert.equal(
    received.response.headers.get("content-security-policy"),
    "sandbox; default-src 'none'",
  );
  f.advance(300000);
  assert.equal((await tenant.request(grant.data.url)).status, 403);
  const renewed = await tenant.request(access);
  await tenant.request("/api/auth/logout", { method: "POST", json: {} });
  assert.equal((await tenant.request(renewed.data.url)).status, 401);
});

test("upload verifies magic bytes, digest, actual size; quota reservations cannot race", async (t) => {
  const { app } = await fixture(t),
    l = client(app);
  await l.login();
  const id = await draft(app, l),
    bytes = new TextEncoder().encode("<svg><script>alert(1)</script></svg>");
  assert.equal(
    (
      await l.request("/api/documents/upload-intent", {
        method: "POST",
        json: {
          leaseId: id,
          purpose: "terms",
          mime: "image/svg+xml",
          size: bytes.length,
          sha256: sha256(bytes),
        },
      })
    ).status,
    422,
  );
  const intent = await l.request("/api/documents/upload-intent", {
    method: "POST",
    json: {
      leaseId: id,
      purpose: "terms",
      mime: "image/png",
      size: bytes.length,
      sha256: sha256(bytes),
    },
  });
  assert.equal(
    (await l.request(intent.data.uploadUrl, { method: "PUT", body: bytes }))
      .status,
    422,
  );
  assert.equal(
    (
      await l.request(intent.data.uploadUrl, {
        method: "PUT",
        body: new Uint8Array(bytes.length + 1),
      })
    ).status,
    413,
  );
  const large = {
    leaseId: id,
    purpose: "terms",
    mime: "image/png",
    size: 10485760,
    sha256: sha256("reservation"),
  };
  const reservations = await Promise.all(
    Array.from({ length: 11 }, () =>
      l.request("/api/documents/upload-intent", {
        method: "POST",
        json: large,
      }),
    ),
  );
  assert.equal(reservations.filter((r) => r.status === 201).length, 9);
  assert.equal(
    reservations.filter((r) => r.data.error?.code === "STORAGE_QUOTA").length,
    2,
  );
});

test("submitted versions are immutable, new versions preserve originals and tampering is detectable", async (t) => {
  const { app } = await fixture(t),
    l = client(app);
  await l.login();
  const id = await draft(app, l),
    first = await upload(app, l, id);
  const second = await upload(app, l, id, { documentId: first.documentId });
  assert.equal(second.version, first.version + 1);
  await assert.rejects(
    app.db.query(
      "UPDATE document_versions SET content_hash=$1 WHERE document_id=$2",
      ["0".repeat(64), first.documentId],
    ),
    /immutable/,
  );
  await assert.rejects(
    app.db.query("DELETE FROM document_versions WHERE document_id=$1", [
      first.documentId,
    ]),
    /immutable/,
  );
  const grant = await l.request(
    "/api/documents/" + first.documentId + "/access?version=1",
  );
  const [row] = await app.db.query(
    "SELECT storage_key FROM document_versions WHERE document_id=$1 AND version=1",
    [first.documentId],
  );
  await app.storage.remove(row.storage_key);
  await app.storage.put(
    row.storage_key,
    new Uint8Array([1, 2, 3]),
    "image/png",
  );
  assert.equal(
    (await l.request(grant.data.url)).data.error.code,
    "COMMITMENT_MISMATCH",
  );
  await app.db.query(
    "UPDATE leases SET terms=jsonb_set(terms,'{title}','\"tampered\"') WHERE id=$1",
    [id],
  );
  assert.equal(
    (await l.request("/api/leases/" + id)).data.error.code,
    "COMMITMENT_MISMATCH",
  );
});

test("asynchronous ZIP exports contain verifiable originals and no cross-lease content", async (t) => {
  const { app } = await fixture(t),
    l = client(app),
    other = client(app);
  await l.login();
  await other.login();
  const id = await draft(app, l),
    file = await upload(app, l, id);
  await draft(app, other, undefined, { title: "SECRET OTHER LEASE" });
  const queued = await l.request("/api/exports", {
    method: "POST",
    json: { leaseId: id },
  });
  assert.equal(queued.status, 202);
  assert.equal(
    (await l.request("/api/exports/" + queued.data.id + "/access")).status,
    409,
  );
  assert.equal(await runExportJob(app), true);
  const status = await l.request("/api/exports/" + queued.data.id);
  assert.equal(status.data.state, "ready", JSON.stringify(status.data));
  assert.equal(
    (await other.request("/api/exports/" + queued.data.id)).status,
    403,
  );
  const grant = await l.request("/api/exports/" + queued.data.id + "/access");
  const zip = await l.request(grant.data.url),
    files = unzipSync(zip.data);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  assert.equal(manifest.leaseId, id);
  assert.equal(manifest.originals.length, 1);
  assert.equal(manifest.originals[0].documentId, file.documentId);
  assert.equal(
    sha256(files[manifest.originals[0].filename]),
    manifest.originals[0].sha256,
  );
  assert.ok(!JSON.stringify(manifest).includes("SECRET OTHER LEASE"));
});

test("database RLS denies anonymous reads even with public schema access", async (t) => {
  const { app } = await fixture(t);
  await app.db.exec(
    "CREATE ROLE api_anon; GRANT USAGE ON SCHEMA public TO api_anon; GRANT SELECT ON leases TO api_anon; SET ROLE api_anon",
  );
  assert.deepEqual(await app.db.query("SELECT * FROM leases"), []);
  await assert.rejects(
    app.db.query("SELECT * FROM sessions"),
    /permission denied/,
  );
  await app.db.exec("RESET ROLE");
});

test("open invitation binds the first signed-in tenant atomically and reveals only a limited preview", async (t) => {
  const { app } = await fixture(t),
    l = client(app),
    a = client(app),
    b = client(app);
  for (const actor of [l, a, b]) await actor.login();
  const id = await draft(app, l),
    invite = await l.request("/api/leases/" + id + "/invites", {
      method: "POST",
      json: {},
    });
  assert.equal(invite.status, 201);
  const preview = await a.request("/api/invites/" + invite.data.token);
  assert.equal(preview.status, 200);
  assert.equal(preview.data.termsText, undefined);
  const results = await Promise.all(
    [a, b].map((actor) =>
      actor.request("/api/invites/" + invite.data.token + "/claim", {
        method: "POST",
        json: { confirm: true },
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(
    (
      await app.db.query(
        "SELECT * FROM lease_members WHERE lease_id=$1 AND role='T'",
        [id],
      )
    ).length,
    1,
  );
});
