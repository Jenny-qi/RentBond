import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { fixture, client, draft, png, upload } from "./helpers.mjs";
import { sha256 } from "../crypto.ts";
import { runScanJob } from "../upload-scans.ts";
import { runExportJob, cleanup } from "../jobs.ts";
import { createScanner } from "../scanner.ts";
import { readConfig } from "../config.ts";
import { finalizeUpload } from "../../features/live/uploads.ts";

export async function pending(app, actor, leaseId, bytes = png()) {
  const result = await actor.request("/api/documents/upload-intent", {
    method: "POST",
    json: {
      leaseId,
      purpose: "terms",
      mime: "image/png",
      size: bytes.length,
      sha256: sha256(bytes),
    },
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const put = await actor.request(result.data.uploadUrl, {
    method: "PUT",
    body: bytes,
  });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  return result.data;
}
async function setup(t) {
  const f = await fixture(t),
    actor = client(f.app),
    stranger = client(f.app);
  await actor.login();
  await stranger.login();
  return { ...f, actor, stranger, leaseId: await draft(f.app, actor) };
}
const submit = (actor, intent) =>
  actor.request("/api/documents/" + intent.documentId + "/submit", {
    method: "POST",
    json: { uploadId: intent.uploadId },
  });

test("quarantine is unreadable until scan completes; C polling finalizes exact version and cross-user status is denied", async (t) => {
  const { app, actor, stranger, leaseId } = await setup(t);
  const intent = await pending(app, actor, leaseId);
  const [row] = await app.db.query("SELECT * FROM document_uploads");
  assert.deepEqual(await app.quarantine.get(row.storage_key), png());
  await assert.rejects(app.storage.get(row.storage_key));
  assert.equal((await submit(actor, intent)).data.error.code, "SCAN_PENDING");
  assert.equal((await stranger.request(intent.statusUrl)).status, 403);
  let waits = 0;
  const result = await finalizeUpload(
    async (path, body) => {
      const res = await actor.request(
        path,
        body === undefined ? {} : { method: "POST", json: body },
      );
      assert.ok(res.status < 400, JSON.stringify(res.data));
      return res.data;
    },
    intent,
    () => true,
    async () => {
      waits++;
      await runScanJob(app);
    },
  );
  assert.equal(waits, 1);
  assert.equal(result.version, 1);
  assert.deepEqual(await app.storage.get(row.storage_key), png());
});

test("rejected and unavailable scanners fail closed, retry at most three times and expire quarantine", async (t) => {
  const { app, actor, leaseId, advance } = await setup(t);
  const rejected = await pending(app, actor, leaseId);
  app.scanner.scan = async () => ({
    clean: false,
    engine: "ClamAV injected rejection",
  });
  await runScanJob(app);
  assert.equal(
    (await submit(actor, rejected)).data.error.code,
    "FILE_REJECTED",
  );
  const unavailable = await pending(app, actor, leaseId);
  let attempts = 0;
  app.scanner.scan = async () => {
    attempts++;
    throw new Error("offline");
  };
  for (let i = 0; i < 4; i++) {
    await runScanJob(app);
    advance(30001);
  }
  assert.equal(attempts, 3);
  assert.equal(
    (await actor.request(unavailable.statusUrl)).data.retryable,
    false,
  );
  assert.equal((await submit(actor, unavailable)).status, 503);
  advance(900001);
  await cleanup(app);
  for (const row of await app.db.query("SELECT * FROM document_uploads")) {
    await assert.rejects(app.storage.get(row.storage_key));
    await assert.rejects(app.quarantine.get(row.storage_key));
  }
  assert.equal((await actor.request(unavailable.statusUrl)).status, 410);
});

test("scan ownership survives competing worker claims and stale completion cannot release a file", async (t) => {
  const { app, actor, leaseId, advance } = await setup(t);
  const intent = await pending(app, actor, leaseId);
  let release, started;
  const entered = new Promise((r) => {
    started = r;
  });
  app.scanner.scan = () => {
    started();
    return new Promise((r) => {
      release = r;
    });
  };
  const first = runScanJob(app);
  await entered;
  assert.equal(await runScanJob(app), false);
  advance(120001);
  app.scanner.scan = async () => ({
    clean: false,
    engine: "ClamAV injected rejection",
  });
  assert.equal(await runScanJob(app), true);
  release({ clean: true, engine: "ClamAV stale worker" });
  await first;
  assert.equal((await submit(actor, intent)).status, 422);
  const [row] = await app.db.query("SELECT * FROM document_uploads");
  await assert.rejects(app.storage.get(row.storage_key));
});

test("legacy originals require rescan, old archives require current policy, and repeated worker crashes stop", async (t) => {
  const { app, actor, leaseId, advance } = await setup(t);
  const file = await upload(app, actor, leaseId);
  const job = (
    await actor.request("/api/exports", { method: "POST", json: { leaseId } })
  ).data;
  await runExportJob(app);
  await app.db.query("UPDATE exports SET scan_policy='disabled-local'");
  assert.equal(
    (await actor.request(job.statusUrl + "/access")).data.error.code,
    "SCAN_UPGRADE_REQUIRED",
  );
  await app.db.query(
    "UPDATE document_uploads SET scan_source='legacy',scan_state='pending',scan_digest=NULL,scan_attempts=0,scan_next_at=0",
  );
  const access = "/api/documents/" + file.documentId + "/access?version=1";
  assert.equal((await actor.request(access)).status, 409);
  await runScanJob(app);
  assert.equal((await actor.request(access)).status, 200);
  const abandoned = await pending(app, actor, leaseId);
  await app.db.query(
    "UPDATE document_uploads SET scan_state='scanning',scan_attempts=3,scan_lock_until=$1 WHERE id=$2",
    [app.now(), abandoned.uploadId],
  );
  advance(1);
  assert.equal(await runScanJob(app), false);
  assert.equal(
    (await actor.request(abandoned.statusUrl)).data.retryable,
    false,
  );
});

test("C upload polling stops on account switch, rejection and timeout without submitting", async () => {
  const intent = {
    documentId: "doc",
    uploadId: "upload",
    statusUrl: "/api/documents/doc/uploads/upload",
  };
  let current = true,
    posts = 0;
  await assert.rejects(
    finalizeUpload(
      async (_, body) => {
        if (body) posts++;
        current = false;
        return { scanStatus: "clean", uploaded: true };
      },
      intent,
      () => current,
    ),
    /account/,
  );
  await assert.rejects(
    finalizeUpload(
      async () => ({ scanStatus: "rejected", uploaded: true }),
      intent,
      () => true,
    ),
    /rejected/,
  );
  await assert.rejects(
    finalizeUpload(
      async () => ({ scanStatus: "pending", uploaded: true }),
      intent,
      () => true,
      async () => {},
    ),
    /pending/,
  );
  assert.equal(posts, 0);
});

test("scanner config forbids public bypass, shared buckets and unbounded timeouts", () => {
  const base = { SESSION_SECRET: "x".repeat(40) };
  assert.throws(
    () =>
      readConfig({
        ...base,
        NEXT_PUBLIC_APP_URL: "https://example.test",
        FILE_SCAN_MODE: "disabled-local",
      }),
    /require ClamAV/,
  );
  assert.throws(
    () =>
      readConfig({ ...base, STORAGE_QUARANTINE_BUCKET: "rentbond-private" }),
    /different/,
  );
  assert.throws(
    () => readConfig({ ...base, FILE_SCAN_TIMEOUT_SECONDS: "999" }),
    /configuration/,
  );
});

test("ClamAV TCP protocol enforces fresh definitions, bounded responses, failures and exact clean reply", async (t) => {
  let version = "ClamAV 1.5.4/28140/" + new Date().toUTCString(),
    reply = "stream: OK",
    streams = 0;
  const server = createServer((socket) => {
    let bytes = Buffer.alloc(0),
      reading = false;
    socket.on("data", (chunk) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (!reading && bytes.includes(0)) {
        const end = bytes.indexOf(0),
          command = bytes.subarray(0, end).toString();
        bytes = bytes.subarray(end + 1);
        if (command === "zVERSION") {
          socket.end(version + "\0");
          return;
        }
        assert.equal(command, "zINSTREAM");
        reading = true;
        streams++;
      }
      if (reading) {
        while (bytes.length >= 4) {
          const n = bytes.readUInt32BE(0);
          if (bytes.length < n + 4) return;
          bytes = bytes.subarray(n + 4);
          if (n === 0) {
            socket.end(reply + "\0");
            return;
          }
        }
      }
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const scanner = createScanner({
    ...readConfig({ SESSION_SECRET: "x".repeat(40) }),
    scanMode: "clamav",
    clamavPort: server.address().port,
    scanTimeoutMs: 500,
  });
  assert.equal((await scanner.scan(png())).clean, true);
  reply = "stream: Win.Test.EICAR FOUND";
  assert.equal((await scanner.scan(png())).clean, false);
  reply = "stream: size limit exceeded. ERROR";
  await assert.rejects(scanner.scan(png()));
  reply = "x".repeat(5000);
  await assert.rejects(scanner.scan(png()));
  const count = streams;
  version = "ClamAV 1.5.4/1/Mon Jan 1 00:00:00 2020";
  await assert.rejects(scanner.scan(png()));
  assert.equal(streams, count);
});
