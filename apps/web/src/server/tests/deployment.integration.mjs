import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { fixture, client, draft, deployed, png, hash } from "./helpers.mjs";
import { createScanner } from "../scanner.ts";
import { readConfig } from "../config.ts";
import { runScanJob } from "../upload-scans.ts";
import { runExportJob } from "../jobs.ts";
import { sha256 } from "../crypto.ts";
import { openDatabase } from "../db.ts";
import {
  createTaskStore,
  syncLease,
} from "../../../../worker/src/persistence/backend.mjs";
import { verifyDeployment, eicar } from "../deployment-check.ts";

function infectedPdf() {
  // Valid PDF with a harmless EICAR attachment. Appending text to a PNG is
  // not a valid EICAR fixture for ClamAV's format-aware parser.
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(eicar.com) 4 0 R] >> >> >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>",
    "<< /Type /Filespec /F (eicar.com) /EF << /F 5 0 R >> >>",
    "<< /Type /EmbeddedFile /Length " +
      eicar().length +
      " >>\nstream\n" +
      eicar().toString() +
      "\nendstream",
  ];
  let text = "%PDF-1.4\n";
  const offsets = [];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(text));
    text += i + 1 + " 0 obj\n" + object + "\nendobj\n";
  }
  const xref = Buffer.byteLength(text);
  text +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("") +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
    xref +
    "\n%%EOF\n";
  return Buffer.from(text);
}

test("selected PostgreSQL + real ClamAV: deployment ACL, EICAR quarantine, two-connection claims and restart", async (t) => {
  assert.ok(
    process.env.RENTBOND_TEST_DATABASE_URL,
    "Set a disposable PostgreSQL database; this check never skips.",
  );
  const root = new pg.Pool({
    connectionString: process.env.RENTBOND_TEST_DATABASE_URL,
  });
  const suffix = randomUUID().replaceAll("-", ""),
    schema = "d_environment_" + suffix,
    role = "d_anon_" + suffix;
  await root.query("CREATE SCHEMA " + schema);
  const url = new URL(process.env.RENTBOND_TEST_DATABASE_URL);
  url.searchParams.set("options", "-c search_path=" + schema);
  const config = readConfig({
    ...process.env,
    DATABASE_URL: url.toString(),
    FILE_SCAN_MODE: "clamav",
  });
  const { dataDir, ...environment } = config;
  const f = await fixture(
    t,
    Object.fromEntries(
      Object.entries(environment).filter(([, v]) => v !== undefined),
    ),
  );
  const { app } = f;
  app.scanner = createScanner(config);
  const second = await openDatabase({ ...config, dataDir: app.config.dataDir });
  t.after(async () => {
    await second.close();
    await root.query("DROP SCHEMA " + schema + " CASCADE");
    await root.query("DROP ROLE IF EXISTS " + role);
    await root.end();
  });
  const check = await verifyDeployment(app);
  t.diagnostic(JSON.stringify(check));
  const actor = client(app),
    stranger = client(app);
  await actor.login();
  await stranger.login();
  const leaseId = await draft(app, actor);
  async function uploadBytes(bytes, mime = "image/png") {
    const intent = (
      await actor.request("/api/documents/upload-intent", {
        method: "POST",
        json: {
          leaseId,
          purpose: "terms",
          mime,
          size: bytes.length,
          sha256: sha256(bytes),
        },
      })
    ).data;
    assert.equal(
      (await actor.request(intent.uploadUrl, { method: "PUT", body: bytes }))
        .status,
      200,
    );
    assert.equal((await stranger.request(intent.statusUrl)).status, 403);
    return intent;
  }
  const infected = await uploadBytes(infectedPdf(), "application/pdf");
  await runScanJob(app);
  assert.equal(
    (await actor.request(infected.statusUrl)).data.scanStatus,
    "rejected",
  );
  assert.equal(
    (
      await actor.request("/api/documents/" + infected.documentId + "/submit", {
        method: "POST",
        json: { uploadId: infected.uploadId },
      })
    ).status,
    422,
  );
  const clean = await uploadBytes(png());
  assert.deepEqual(
    (
      await Promise.all([runScanJob(app), runScanJob({ ...app, db: second })])
    ).sort(),
    [false, true],
  );
  assert.equal(
    (
      await actor.request("/api/documents/" + clean.documentId + "/submit", {
        method: "POST",
        json: { uploadId: clean.uploadId },
      })
    ).status,
    201,
  );
  const exportJob = (
    await actor.request("/api/exports", { method: "POST", json: { leaseId } })
  ).data;
  await runExportJob(app);
  const access = await actor.request(exportJob.statusUrl + "/access");
  assert.equal(access.status, 200, JSON.stringify(access.data));
  assert.equal((await stranger.request(access.data.url)).status, 403);
  assert.equal((await actor.request(access.data.url)).status, 200);
  assert.equal((await stranger.request("/api/leases/" + leaseId)).status, 403);
  const tenant = client(app),
    primary = client(app),
    fallback = client(app);
  await tenant.login();
  const lease = await deployed(f, actor, tenant, primary, fallback);
  await syncLease(app, lease.leaseId);
  const input = {
    leaseId: lease.leaseId,
    kind: "CLOSE_CLAIMS",
    dueAt: lease.snapshot.schedule.claimDeadline,
    sourceBlock: "1",
    sourceHash: hash(500),
  };
  const a = createTaskStore(app),
    b = createTaskStore({ ...app, db: second });
  const tasks = await Promise.all([a.enqueue(input), b.enqueue(input)]);
  assert.equal(tasks[0].id, tasks[1].id);
  const claims = await Promise.all([
    a.claim(input.dueAt),
    b.claim(input.dueAt),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  f.advance(120001);
  const third = await openDatabase({ ...config, dataDir: app.config.dataDir });
  try {
    const recovered = await createTaskStore({ ...app, db: third }).claim(
      input.dueAt,
    );
    assert.equal(recovered.id, tasks[0].id);
    assert.notEqual(recovered.lock_token, claims.find(Boolean).lock_token);
  } finally {
    await third.close();
  }
  // Exercise actual PostgreSQL RLS with SELECT/INSERT privileges granted to an untrusted role.
  const connection = await root.connect();
  try {
    await connection.query("CREATE ROLE " + role);
    await connection.query("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
    await connection.query(
      "GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA " + schema + " TO " + role,
    );
    await connection.query("SET ROLE " + role);
    for (const table of [
      "leases",
      "sessions",
      "document_uploads",
      "exports",
      "worker_tasks",
    ])
      assert.equal(
        (await connection.query("SELECT * FROM " + schema + "." + table)).rows
          .length,
        0,
      );
    await assert.rejects(
      connection.query(
        "INSERT INTO " + schema + ".users(wallet,created_at) VALUES($1,1)",
        ["0x" + "55".repeat(20)],
      ),
      /row-level security/,
    );
  } finally {
    await connection.query("RESET ROLE");
    connection.release();
  }
  t.diagnostic((await root.query("SELECT version()")).rows[0].version);
});
