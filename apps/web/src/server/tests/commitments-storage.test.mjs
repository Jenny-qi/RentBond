import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { fixture, client, draft, png } from "./helpers.mjs";
import {
  canonicalJson,
  computeTermsCommitment,
  verifyTermsCommitment,
} from "../crypto.ts";
import { openDatabase, migrate } from "../db.ts";
import { createStorage } from "../storage.ts";
import { readConfig } from "../config.ts";
import { createSecp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";

test("commitment canonicalization, salt isolation and fixed Solidity-compatible keccak vector", () => {
  const a = {
    schemaVersion: "1.0.0",
    amount: "1000000000",
    details: { b: 2, a: "test" },
  };
  const b = {
    details: { a: "test", b: 2 },
    amount: "1000000000",
    schemaVersion: "1.0.0",
  };
  const salt = "0x" + "01".repeat(32);
  assert.equal(
    computeTermsCommitment(JSON.stringify(a), salt),
    "0x2e3ecc163395ad4ca90f62ebc0ddf4d68224b5ae64bba51fc1932f3a31004cae",
  );
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(
    computeTermsCommitment(JSON.stringify(a), salt),
    computeTermsCommitment(JSON.stringify(b), salt),
  );
  assert.notEqual(
    computeTermsCommitment(JSON.stringify(a), salt),
    computeTermsCommitment(JSON.stringify(a), "0x" + "02".repeat(32)),
  );
  assert.equal(
    verifyTermsCommitment(
      JSON.stringify({ ...a, amount: "2000000000" }),
      salt,
      computeTermsCommitment(JSON.stringify(a), salt),
    ),
    false,
  );
  assert.throws(() => computeTermsCommitment("{}", salt));
  assert.throws(() => canonicalJson({ schemaVersion: "1.0.0", amount: 1.1 }));
});
test("Mera signing-session adapter logs into SIWE and restored same address keeps membership; different address denied", async (t) => {
  const { app } = await fixture(t);
  const key = new Uint8Array(32).fill(7);
  const first = createSecp256k1SigningSession({ privateKey: key });
  const actor = client(app, toViemAccount(first));
  await actor.login();
  const lease = await draft(app, actor);
  first.end();
  const recovered = createSecp256k1SigningSession({ privateKey: key });
  const restored = client(app, toViemAccount(recovered));
  await restored.login();
  assert.equal((await restored.request("/api/leases/" + lease)).status, 200);
  const changed = createSecp256k1SigningSession({
    privateKey: new Uint8Array(32).fill(8),
  });
  const stranger = client(app, toViemAccount(changed));
  await stranger.login();
  assert.equal((await stranger.request("/api/leases/" + lease)).status, 403);
  recovered.end();
  changed.end();
  key.fill(0);
});
test("local database survives close/reopen and refuses concurrent file owners", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rentbond-durable-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = { dataDir: directory };
  const first = await openDatabase(config);
  await migrate(first, "0001_member_d.sql");
  await first.query(
    "INSERT INTO users(wallet,created_at) VALUES('0x1111111111111111111111111111111111111111',1)",
  );
  await assert.rejects(openDatabase(config), /already open/);
  await first.close();
  const second = await openDatabase(config);
  try {
    assert.equal((await second.query("SELECT * FROM users")).length, 1);
    assert.deepEqual(await migrate(second), [
      "0002_new_account_invitations.sql",
    ]);
    assert.deepEqual(await migrate(second), []);
  } finally {
    await second.close();
  }
});
test("Supabase REST adapter uses private credentials server-side and refuses overwrite/public bucket configuration", async (t) => {
  const objects = new Map();
  let publicBucket = false;
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer fixture-service-key");
    assert.equal(req.headers.apikey, "fixture-service-key");
    res.setHeader("content-type", "application/json");
    if (req.url.startsWith("/storage/v1/bucket/")) {
      res.end(
        JSON.stringify({
          public: publicBucket,
          file_size_limit: 157286400,
          allowed_mime_types: [
            "image/jpeg",
            "image/png",
            "application/pdf",
            "application/zip",
          ],
        }),
      );
      return;
    }
    const key = req.url.slice("/storage/v1/object/rentbond-private/".length);
    if (req.method === "POST") {
      assert.equal(req.headers["x-upsert"], "false");
      if (objects.has(key)) {
        res.writeHead(409).end("{}");
        return;
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      objects.set(key, Buffer.concat(chunks));
      res.end("{}");
    } else if (req.method === "GET") {
      if (!objects.has(key)) {
        res.writeHead(404).end("{}");
        return;
      }
      res.end(objects.get(key));
    } else if (req.method === "DELETE") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      for (const k of JSON.parse(Buffer.concat(chunks)).prefixes)
        objects.delete(k);
      res.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const config = {
    storageUrl: "http://127.0.0.1:" + server.address().port,
    storageKey: "fixture-service-key",
    storageBucket: "rentbond-private",
  };
  const storage = createStorage(config),
    key = "test-lease/test-file";
  assert.equal(await storage.health(), true);
  await storage.put(key, png(), "image/png");
  assert.deepEqual(await storage.get(key), png());
  await assert.rejects(storage.put(key, png(), "image/png"));
  await storage.remove(key);
  await assert.rejects(storage.get(key));
  publicBucket = true;
  assert.equal(await storage.health(), false);
  await assert.rejects(storage.get("../outside"));
});
test("configuration rejects insecure public HTTP, unknown/mainnet chains, incomplete credentials and excessive gas", () => {
  const base = { SESSION_SECRET: "x".repeat(40) };
  assert.equal(readConfig(base).mode, "local");
  assert.throws(
    () => readConfig({ ...base, NEXT_PUBLIC_APP_URL: "http://public.example" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      readConfig({
        ...base,
        NEXT_PUBLIC_APP_URL: "https://example.test",
        NEXT_PUBLIC_APP_ENV: "testnet",
        CHAIN_ID: "1",
      }),
    /chain/,
  );
  assert.throws(
    () => readConfig({ ...base, STORAGE_URL: "https://example.test" }),
    /together/,
  );
  assert.throws(
    () => readConfig({ ...base, TEST_GAS_AMOUNT_WEI: "100000000000000001" }),
    /ceiling/,
  );
});
