import test from "node:test";
import assert from "node:assert/strict";
import { fixture, client, draft, upload, deployed } from "./helpers.mjs";
import { purgeRequestedLease } from "../jobs.ts";

test("early deletion requires both parties and purges originals while retaining immutable audit references", async (t) => {
  const { app } = await fixture(t),
    l = client(app),
    tenant = client(app);
  await l.login();
  await tenant.login();
  const id = await draft(app, l, tenant),
    file = await upload(app, l, id);
  const request = "/api/leases/" + id + "/cleanup-request";
  await l.request(request, { method: "POST", json: { confirm: true } });
  await assert.rejects(
    purgeRequestedLease(app, id),
    (e) => e.code === "CONSENT_REQUIRED",
  );
  await tenant.request(request, { method: "POST", json: { confirm: true } });
  assert.equal((await purgeRequestedLease(app, id)).purged, true);
  assert.equal(
    (
      await tenant.request(
        "/api/documents/" + file.documentId + "/access?version=1",
      )
    ).status,
    410,
  );
  assert.equal(
    (await app.db.query("SELECT * FROM document_versions")).length,
    1,
  );
});

test("gas before deployment requires explicit organizer approval of a joined and frozen draft", async (t) => {
  const f = await fixture(t, {
      mode: "testnet",
      chainId: 10143,
      sponsorKey: "test-double-only",
    }),
    { app } = f;
  const [l, tenant, r, fallback] = Array.from({ length: 4 }, () => client(app));
  for (const actor of [l, tenant, r, fallback]) await actor.login();
  const deployedLease = await deployed(f, l, tenant, r, fallback);
  const [profile] = await app.db.query("SELECT id FROM service_profiles");
  const id = await draft(app, l, tenant, { serviceProfileId: profile.id });
  const gas = () =>
    l.request("/api/test-gas/request", {
      method: "POST",
      json: { leaseId: id },
    });
  assert.equal((await gas()).data.error.code, "GAS_NOT_ELIGIBLE");
  app.config.gasOrganizers = [l.wallet];
  assert.equal((await gas()).status, 403);
  assert.equal(
    (
      await l.request("/api/leases/drafts/" + id + "/prepare", {
        method: "POST",
        json: { version: 2 },
      })
    ).status,
    200,
  );
  assert.equal((await gas()).status, 202);
  assert.equal(
    (
      await tenant.request("/api/test-gas/request", {
        method: "POST",
        json: { leaseId: id },
      })
    ).status,
    202,
  );
  assert.equal(
    (
      await l.request("/api/test-gas/request", {
        method: "POST",
        json: { leaseId: deployedLease.leaseId },
      })
    ).status,
    429,
  );
});
