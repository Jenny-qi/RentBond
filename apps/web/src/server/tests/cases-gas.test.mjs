import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, client, deployed, upload, hash } from "./helpers.mjs";
import { runGasJob, runExportJob, cleanup } from "../jobs.ts";
import { syncLease } from "../projections.ts";
import { unavailable } from "../errors.ts";

async function setup(t, config = {}) {
  const f = await fixture(t, config),
    { app } = f;
  const [l, tenant, r, fallback, other] = Array.from({ length: 5 }, () =>
    client(app),
  );
  for (const actor of [l, tenant, r, fallback, other]) await actor.login();
  const lease = await deployed(f, l, tenant, r, fallback);
  return { ...f, ...lease, l, tenant, r, fallback, other };
}
async function openCase(f) {
  const { snapshot, app } = f,
    id = randomUUID();
  snapshot.phase = 7;
  snapshot.activeCase = {
    exists: true,
    caseId: "1",
    caseType: 2,
    phase: 1,
    evidenceDeadline: String(snapshot.chainTime + 60),
    primaryDeadline: String(snapshot.chainTime + 120),
    fallbackStartAt: "0",
    fallbackDeadline: "0",
  };
  await app.db.query(
    "INSERT INTO cases(id,lease_id,chain_case_id,snapshot,synced_at) VALUES($1,$2,$3,$4,$5)",
    [id, f.leaseId, "1", JSON.stringify(snapshot.activeCase), app.now()],
  );
  return id;
}
test("AT44: fallback reads only the escalated case; existing links are rechecked against current chain roles", async (t) => {
  const f = await setup(t),
    { app, l, r, fallback, other, snapshot } = f,
    caseId = await openCase(f);
  const file = await upload(app, l, f.leaseId, { purpose: "case", caseId });
  const access =
    "/api/documents/" + file.documentId + "/access?version=1&caseId=" + caseId;
  assert.equal((await fallback.request(access)).status, 403);
  assert.equal((await fallback.request("/api/cases/" + caseId)).status, 403);
  assert.equal(
    (await fallback.request("/api/resolver/cases")).data.items.length,
    0,
  );
  assert.equal((await other.request("/api/cases/" + caseId)).status, 403);
  const primaryLink = await r.request(access);
  assert.equal(primaryLink.status, 200);
  snapshot.activeCase.phase = 3;
  snapshot.activeCase.fallbackStartAt = String(snapshot.chainTime);
  snapshot.activeCase.fallbackDeadline = String(snapshot.chainTime + 60);
  assert.equal((await r.request(primaryLink.data.url)).status, 403);
  const link = await fallback.request(access);
  assert.equal(link.status, 200);
  assert.equal((await fallback.request(link.data.url)).status, 200);
  assert.equal(
    (await fallback.request("/api/leases/" + f.leaseId)).status,
    403,
  );
  assert.equal(
    (
      await fallback.request("/api/exports", {
        method: "POST",
        json: { leaseId: f.leaseId },
      })
    ).status,
    403,
  );
  const secondCase = randomUUID();
  await app.db.query(
    "INSERT INTO cases(id,lease_id,chain_case_id,snapshot,synced_at) VALUES($1,$2,$3,$4,$5)",
    [
      secondCase,
      f.leaseId,
      "2",
      JSON.stringify({ ...snapshot.activeCase, caseId: "2" }),
      app.now(),
    ],
  );
  assert.equal(
    (
      await fallback.request(
        "/api/documents/" +
          file.documentId +
          "/access?version=1&caseId=" +
          secondCase,
      )
    ).status,
    403,
  );
  const exp = await fallback.request("/api/exports", {
    method: "POST",
    json: { leaseId: f.leaseId, caseId },
  });
  assert.equal(exp.status, 202);
  await runExportJob(app);
  assert.equal(
    (await fallback.request("/api/exports/" + exp.data.id)).data.state,
    "ready",
  );
  snapshot.activeCase.phase = 5;
  assert.equal((await fallback.request(link.data.url)).status, 403);
});
test("case evidence deadline, version references and append-only manifests; new versions have no inherited acknowledgement", async (t) => {
  const f = await setup(t),
    { app, l, tenant, snapshot } = f,
    caseId = await openCase(f);
  const original = await upload(app, l, f.leaseId, { purpose: "move-in" });
  const input = {
    leaseId: f.leaseId,
    stage: "case",
    items: [
      {
        roomKey: "kitchen",
        description: "Fictional evidence",
        documents: [{ documentId: original.documentId, version: 1 }],
      },
    ],
  };
  const first = await l.request("/api/cases/" + caseId + "/evidence", {
    method: "POST",
    json: input,
  });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const second = await l.request("/api/cases/" + caseId + "/evidence", {
    method: "POST",
    json: { ...input, bundleId: first.data.manifest.bundleId },
  });
  assert.equal(second.data.manifest.version, 2);
  assert.equal(second.data.acknowledged, false);
  assert.notEqual(second.data.commitment, first.data.commitment);
  await assert.rejects(
    app.db.query("UPDATE evidence_bundles SET commitment='bad' WHERE id=$1", [
      first.data.id,
    ]),
    /immutable/,
  );
  const bad = {
    ...input,
    items: [
      {
        ...input.items[0],
        documents: [{ documentId: original.documentId, version: 99 }],
      },
    ],
  };
  assert.equal(
    (
      await tenant.request("/api/cases/" + caseId + "/evidence", {
        method: "POST",
        json: bad,
      })
    ).status,
    403,
  );
  snapshot.chainTime = Number(snapshot.activeCase.evidenceDeadline);
  assert.equal(
    (
      await l.request("/api/cases/" + caseId + "/evidence", {
        method: "POST",
        json: input,
      })
    ).data.error.code,
    "EVIDENCE_WINDOW_CLOSED",
  );
  snapshot.activeCase.phase = 3;
  snapshot.activeCase.fallbackStartAt = String(snapshot.chainTime);
  assert.equal(
    (
      await l.request("/api/cases/" + caseId + "/evidence", {
        method: "POST",
        json: input,
      })
    ).status,
    201,
  );
  snapshot.chainTime += 30;
  assert.equal(
    (
      await l.request("/api/cases/" + caseId + "/evidence", {
        method: "POST",
        json: input,
      })
    ).status,
    409,
  );
});
test("claims enforce role, 10-item cap, exact business amounts, deposit cap and chain deadlines", async (t) => {
  const f = await setup(t),
    { l, tenant, snapshot } = f;
  snapshot.phase = 5;
  const item = {
    category: "cleaning",
    amount: "100000000",
    reason: "The fictional kitchen requires cleaning.",
    clause: "Clause 1",
    documents: [],
    noEvidenceReason: "Test without a photo",
  };
  const body = { leaseId: f.leaseId, items: [item] };
  assert.equal(
    (await tenant.request("/api/claims/draft", { method: "POST", json: body }))
      .status,
    403,
  );
  const valid = await l.request("/api/claims/draft", {
    method: "POST",
    json: body,
  });
  assert.equal(valid.status, 201, JSON.stringify(valid.data));
  assert.equal(valid.data.onChain, false);
  assert.equal(valid.data.transaction.args[0][0].amount, item.amount);
  assert.equal(
    (
      await l.request("/api/claims/draft", {
        method: "POST",
        json: { ...body, items: Array.from({ length: 11 }, () => item) },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await l.request("/api/claims/draft", {
        method: "POST",
        json: { ...body, items: [{ ...item, amount: "1000000001" }] },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await l.request("/api/claims/draft", {
        method: "POST",
        json: { ...body, items: [{ ...item, amount: "2000000000" }] },
      })
    ).status,
    422,
  );
  snapshot.claims = [
    {
      id: "1",
      amount: item.amount,
      commitment: valid.data.transaction.args[0][0].commitment,
    },
  ];
  assert.equal(
    (await l.request("/api/claims/draft", { method: "POST", json: body }))
      .status,
    409,
  );
  snapshot.claims = [];
  snapshot.chainTime = Number(snapshot.schedule.claimDeadline);
  assert.equal(
    (await l.request("/api/claims/draft", { method: "POST", json: body }))
      .status,
    409,
  );
});
test("AT43: gas eligibility, concurrent quotas, bounded retries, low balance and restart-safe exact rebroadcast", async (t) => {
  const f = await setup(t, {
      mode: "testnet",
      chainId: 10143,
      sponsorKey: "test-double-only",
    }),
    { app, l, tenant, other } = f;
  assert.equal(
    (
      await other.request("/api/test-gas/request", {
        method: "POST",
        json: { leaseId: f.leaseId },
      })
    ).status,
    403,
  );
  const requests = await Promise.all(
    [1, 2].map(() =>
      tenant.request("/api/test-gas/request", {
        method: "POST",
        json: { leaseId: f.leaseId },
      }),
    ),
  );
  assert.deepEqual(requests.map((r) => r.status).sort(), [202, 429]);
  const job = requests.find((r) => r.status === 202).data;
  let preparations = 0;
  app.chain.prepareGas = async () => {
    preparations++;
    return { raw: "0xfeed", hash: hash(900) };
  };
  let attempts = 0;
  app.chain.broadcast = async (raw) => {
    assert.equal(raw, "0xfeed");
    attempts++;
    throw unavailable();
  };
  await runGasJob(app);
  assert.equal(preparations, 1);
  for (let i = 0; i < 5; i++) {
    f.advance(10000);
    await runGasJob(app);
  }
  assert.equal(preparations, 1);
  assert.equal(attempts, 3);
  const waiting = await tenant.request("/api/test-gas/requests/" + job.id);
  assert.equal(waiting.data.state, "prepared");
  app.chain.receipt = async () => ({
    status: "success",
    gasUsed: "21000",
    effectiveGasPrice: "1",
  });
  f.advance(30000);
  await runGasJob(app);
  assert.equal(
    (await tenant.request("/api/test-gas/requests/" + job.id)).data.state,
    "confirmed",
  );
  const low = await l.request("/api/test-gas/request", {
    method: "POST",
    json: { leaseId: f.leaseId },
  });
  app.chain.prepareGas = async () => {
    throw new Error("insufficient sponsor balance");
  };
  for (let i = 0; i < 3; i++) {
    f.advance(30000);
    await runGasJob(app);
  }
  assert.equal(
    (await l.request("/api/test-gas/requests/" + low.data.id)).data.state,
    "failed",
  );
  assert.equal(
    (await app.db.query("SELECT * FROM test_gas_requests")).length,
    2,
  );
});
test("event synchronization is atomic, replay is idempotent, reorg invalidates old events and failed reads preserve last projection", async (t) => {
  const f = await setup(t),
    { app, snapshot } = f;
  let events = [
    {
      transactionHash: hash(701),
      logIndex: 0,
      blockHash: hash(500),
      blockNumber: "1",
      address: f.address,
      eventName: "Funded",
      args: { amount: "1000000000" },
    },
  ];
  app.chain.events = async () => events;
  await syncLease(app, f.leaseId);
  await syncLease(app, f.leaseId);
  assert.equal(
    (await app.db.query("SELECT * FROM chain_events WHERE event_name='Funded'"))
      .length,
    1,
  );
  snapshot.blockHash = hash(501);
  app.chain.blockHash = async () => hash(501);
  events = [{ ...events[0], transactionHash: hash(702), blockHash: hash(501) }];
  await syncLease(app, f.leaseId);
  assert.equal(
    (
      await app.db.query(
        "SELECT * FROM chain_events WHERE event_name='Funded' AND canonical=true",
      )
    ).length,
    1,
  );
  assert.equal(
    (
      await app.db.query(
        "SELECT * FROM chain_events WHERE event_name='Funded' AND canonical=false",
      )
    ).length,
    1,
  );
  const before = (
    await app.db.query("SELECT projection FROM leases WHERE id=$1", [f.leaseId])
  )[0].projection;
  app.chain.lease = async () => {
    throw unavailable();
  };
  await assert.rejects(syncLease(app, f.leaseId));
  assert.deepEqual(
    (
      await app.db.query("SELECT projection FROM leases WHERE id=$1", [
        f.leaseId,
      ])
    )[0].projection,
    before,
  );
});
test("90-day retention deletes private originals only after confirmed closed state", async (t) => {
  const f = await setup(t),
    file = await upload(f.app, f.l, f.leaseId, { purpose: "move-in" });
  const [row] = await f.app.db.query(
    "SELECT storage_key FROM document_versions WHERE document_id=$1",
    [file.documentId],
  );
  f.snapshot.phase = 11;
  f.snapshot.accounting.unallocated = "0";
  f.snapshot.accounting.tenantWithdrawn = "1000000000";
  await syncLease(f.app, f.leaseId);
  f.advance(90 * 86400000 - 1);
  assert.equal((await cleanup(f.app)).leases, 0);
  f.advance(1);
  assert.equal((await cleanup(f.app)).leases, 1);
  await assert.rejects(f.app.storage.get(row.storage_key));
  assert.equal(
    (
      await f.app.db.query(
        "SELECT * FROM document_versions WHERE document_id=$1",
        [file.documentId],
      )
    ).length,
    1,
  );
});
