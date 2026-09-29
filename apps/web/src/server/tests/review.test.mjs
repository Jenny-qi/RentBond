import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { fixture, client, deployed, upload, hash } from "./helpers.mjs";
import { recordEvents } from "../projections.ts";
import { runGasJob, runExportJob } from "../jobs.ts";
import { createServer } from "node:http";
import { createChain } from "../chain.ts";

test("review: a primary RPC that answers chain ID but fails reads falls back to the validated secondary", async (t) => {
  let backupReads = 0,
    backupChain = "0x7a69";
  const serve = async (primary) => {
    const server = createServer(async (req, res) => {
      const parts = [];
      for await (const chunk of req) parts.push(chunk);
      const input = JSON.parse(Buffer.concat(parts));
      if (input.method !== "eth_chainId" && primary) {
        res.writeHead(503).end("unavailable");
        return;
      }
      if (input.method !== "eth_chainId") backupReads++;
      const result =
        input.method === "eth_chainId"
          ? primary
            ? "0x7a69"
            : backupChain
          : {
              number: "0x1",
              hash: hash(501),
              parentHash: hash(500),
              timestamp: "0x1",
              gasLimit: "0x1000000",
              gasUsed: "0x0",
              transactions: [],
              uncles: [],
            };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: input.id, result }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return "http://127.0.0.1:" + server.address().port;
  };
  const chain = createChain({
    mode: "local",
    chainId: 31337,
    confirmations: 1,
    rpcUrl: await serve(true),
    rpcFallbackUrl: await serve(false),
  });
  assert.equal(await chain.blockHash("1"), hash(501));
  assert.equal(backupReads, 1);
  backupChain = "0x1";
  await assert.rejects(
    chain.blockHash("1"),
    (error) => error.code === "RPC_CHAIN_MISMATCH",
  );
});

async function setup(t, config = {}) {
  const f = await fixture(t, config);
  const [l, tenant, r, fallback] = Array.from({ length: 4 }, () =>
    client(f.app),
  );
  for (const actor of [l, tenant, r, fallback]) await actor.login();
  return {
    ...f,
    ...(await deployed(f, l, tenant, r, fallback)),
    l,
    tenant,
    r,
    fallback,
  };
}
async function event(f, name, args, index) {
  await recordEvents(f.app.db, f.app.config.chainId, f.leaseId, [
    {
      address: f.address,
      eventName: name,
      args,
      transactionHash: hash(700 + index),
      logIndex: index,
      blockHash: hash(500),
      blockNumber: String(index + 2),
    },
  ]);
}
async function openCase(f, type = 2, id = "1") {
  const caseId = randomUUID();
  f.snapshot.phase = type === 2 ? 7 : 4;
  f.snapshot.activeCase = {
    exists: true,
    caseId: id,
    caseType: type,
    phase: 1,
    evidenceDeadline: String(f.snapshot.chainTime + 60),
    primaryDeadline: String(f.snapshot.chainTime + 120),
    fallbackStartAt: "0",
    fallbackDeadline: "0",
  };
  await f.app.db.query(
    "INSERT INTO cases(id,lease_id,chain_case_id,snapshot,synced_at) VALUES($1,$2,$3,$4,$5)",
    [caseId, f.leaseId, id, JSON.stringify(f.snapshot.activeCase), f.app.now()],
  );
  return caseId;
}

test("review: final-deadline gas remains available for funded exit and withdrawal, but not resolvers or closed leases", async (t) => {
  const f = await setup(t, {
    mode: "testnet",
    chainId: 10143,
    sponsorKey: hash(100),
  });
  f.snapshot.chainTime = Number(f.snapshot.terms.hardEndAt);
  const request = (actor) =>
    actor.request("/api/test-gas/request", {
      method: "POST",
      json: { leaseId: f.leaseId },
    });
  assert.equal((await request(f.tenant)).status, 202);
  assert.equal((await request(f.r)).status, 409);
  f.snapshot.phase = 10;
  f.snapshot.accounting.unallocated = "0";
  f.snapshot.accounting.tenantCredit = "1000000000";
  await runGasJob(f.app);
  assert.equal(f.sent.length, 1);
  assert.equal((await request(f.l)).status, 202);
  f.snapshot.phase = 11;
  f.snapshot.accounting.tenantCredit = "0";
  assert.equal((await request(f.fallback)).status, 409);
});

test("review: resolvers see confirmed claim responses and exact supporting originals without a duplicate case upload", async (t) => {
  const f = await setup(t);
  const file = await upload(f.app, f.l, f.leaseId, { purpose: "claim" });
  const unrelated = await upload(f.app, f.l, f.leaseId, { purpose: "repair" });
  const counter = await upload(f.app, f.tenant, f.leaseId, {
    purpose: "claim",
  });
  f.snapshot.phase = 5;
  const created = await f.l.request("/api/claims/draft", {
    method: "POST",
    json: {
      leaseId: f.leaseId,
      items: [
        {
          category: "damage",
          amount: "200000000",
          reason: "Fictional claim with an original supporting document.",
          clause: "Clause 1",
          documents: [{ documentId: file.documentId, version: 1 }],
        },
      ],
    },
  });
  assert.equal(created.status, 201);
  f.snapshot.claims = [
    {
      id: "1",
      amount: "200000000",
      commitment: created.data.manifest.items[0].commitment,
      status: 2,
    },
  ];
  await f.app.db.query("UPDATE leases SET projection=$1 WHERE id=$2", [
    JSON.stringify(f.snapshot),
    f.leaseId,
  ]);
  const respond = () =>
    f.tenant.request("/api/leases/" + f.leaseId + "/statements", {
      method: "POST",
      json: {
        kind: "claim-response",
        claimId: "1",
        accept: false,
        reason: "I dispute this fictional damage claim for these reasons.",
        documents: [{ documentId: counter.documentId, version: 1 }],
      },
    });
  const response = await respond(),
    privateDraft = await respond();
  assert.equal(response.status, 201);
  await event(
    f,
    "ClaimResponded",
    {
      claimId: "1",
      accepted: false,
      responseCommitment: response.data.commitment,
    },
    0,
  );
  const caseId = await openCase(f);
  const page = await f.r.request("/api/cases/" + caseId);
  assert.equal(page.status, 200);
  assert.deepEqual(
    page.data.statements.map((s) => s.id),
    [response.data.id],
  );
  assert.equal(page.data.statements[0].onChain, true);
  assert.ok(!page.data.statements.some((s) => s.id === privateDraft.data.id));
  const access = (doc, actor = f.r) =>
    actor.request(
      "/api/documents/" + doc.documentId + "/access?version=1&caseId=" + caseId,
    );
  assert.equal((await access(file)).status, 200);
  assert.equal((await access(unrelated)).status, 403);
  assert.equal((await access(file, f.fallback)).status, 403);
  const exp = await f.r.request("/api/exports", {
    method: "POST",
    json: { leaseId: f.leaseId, caseId },
  });
  await runExportJob(f.app);
  const grant = await f.r.request("/api/exports/" + exp.data.id + "/access");
  assert.equal(grant.status, 200, JSON.stringify(grant.data));
  const zip = unzipSync((await f.r.request(grant.data.url)).data);
  const manifest = JSON.parse(strFromU8(zip["manifest.json"]));
  assert.deepEqual(
    manifest.originals.map((o) => o.documentId).sort(),
    [file.documentId, counter.documentId].sort(),
  );
  assert.equal(manifest.statements[0].id, response.data.id);
});

test("review: checkout cases include their confirmed request and originals without exposing an earlier checkout", async (t) => {
  const f = await setup(t);
  const old = await upload(f.app, f.l, f.leaseId, { purpose: "move-out" });
  const file = await upload(f.app, f.l, f.leaseId, { purpose: "move-out" });
  const request = (doc) =>
    f.l.request("/api/leases/" + f.leaseId + "/statements", {
      method: "POST",
      json: {
        kind: "checkout",
        actualAt: f.snapshot.chainTime,
        reason: "Fictional checkout supporting information.",
        documents: [{ documentId: doc.documentId, version: 1 }],
      },
    });
  const earlier = await request(old),
    current = await request(file);
  assert.equal(current.status, 201);
  await event(
    f,
    "CheckoutRequested",
    { evidenceHash: earlier.data.commitment },
    0,
  );
  await event(f, "CaseOpened", { caseId: "1", caseType: 1 }, 1);
  await event(
    f,
    "CheckoutRequested",
    { evidenceHash: current.data.commitment },
    2,
  );
  const caseId = await openCase(f, 1, "2");
  await event(f, "CaseOpened", { caseId: "2", caseType: 1 }, 3);
  const page = await f.r.request("/api/cases/" + caseId);
  assert.equal(page.status, 200);
  assert.deepEqual(
    page.data.statements.map((s) => s.id),
    [current.data.id],
  );
  const access = (doc) =>
    f.r.request(
      "/api/documents/" + doc.documentId + "/access?version=1&caseId=" + caseId,
    );
  assert.equal((await access(file)).status, 200);
  assert.equal((await access(old)).status, 403);
});

test("review: capture time is separate from submission; authors append withdrawal notes without rewriting evidence", async (t) => {
  const f = await setup(t);
  const file = await upload(f.app, f.l, f.leaseId, { purpose: "move-in" });
  const capturedAt = f.app.now() - 86400000;
  const bundle = await f.l.request("/api/inspections", {
    method: "POST",
    json: {
      leaseId: f.leaseId,
      stage: "move-in",
      items: [
        {
          roomKey: "kitchen",
          description: "Fictional inspection",
          capturedAt,
          documents: [{ documentId: file.documentId, version: 1 }],
        },
      ],
    },
  });
  assert.equal(bundle.status, 201, JSON.stringify(bundle.data));
  assert.equal(bundle.data.manifest.items[0].capturedAt, capturedAt);
  assert.equal(bundle.data.manifest.submittedAt, f.app.now());
  const body = {
    kind: "evidence-withdrawal",
    bundleId: bundle.data.manifest.bundleId,
    version: 1,
    reason: "This fictional photo was associated with the wrong inspection.",
  };
  const path = "/api/leases/" + f.leaseId + "/statements";
  assert.equal(
    (await f.tenant.request(path, { method: "POST", json: body })).status,
    403,
  );
  const note = await f.l.request(path, { method: "POST", json: body });
  assert.equal(note.status, 201, JSON.stringify(note.data));
  assert.equal(note.data.transaction, null);
  const page = await f.tenant.request("/api/leases/" + f.leaseId);
  assert.equal(page.data.bundles[0].commitment, bundle.data.commitment);
  assert.equal(
    page.data.statements[0].manifest.targetCommitment,
    bundle.data.commitment,
  );
  assert.equal(page.data.statements[0].onChain, false);
});
