import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { unzipSync } from "fflate";

const origin = process.env.RENTBOND_TEST_BASE_URL;
assert.ok(
  origin,
  "Set RENTBOND_TEST_BASE_URL to an initialized local Next server.",
);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
);
// This explicit smoke command creates fictional records in the selected local database.
function actor() {
  const account = privateKeyToAccount(generatePrivateKey());
  const jar = new Map();
  async function request(path, { method = "GET", json, body } = {}) {
    const headers = {
      origin,
      cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      "idempotency-key": randomUUID(),
    };
    if (json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const response = await fetch(new URL(path, origin), {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0],
        index = pair.indexOf("=");
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : new Uint8Array(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  }
  async function login() {
    const nonce = await request("/api/auth/nonce");
    assert.equal(nonce.status, 200, JSON.stringify(nonce.data));
    const message = createSiweMessage({
      ...nonce.data,
      address: account.address,
      version: "1",
      issuedAt: new Date(nonce.data.issuedAt),
      expirationTime: new Date(nonce.data.expirationTime),
    });
    const result = await request("/api/auth/verify", {
      method: "POST",
      json: { message, signature: await account.signMessage({ message }) },
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  return { request, login };
}
const owner = actor(),
  stranger = actor();
assert.equal((await owner.request("/api/health")).status, 200);
assert.equal((await owner.request("/api/leases")).status, 401);
await owner.login();
await stranger.login();
const now = Math.floor(Date.now() / 1000);
const draft = await owner.request("/api/leases/drafts", {
  method: "POST",
  json: {
    title: "Fictional HTTP smoke lease",
    termsText: "Local automated test only.",
    depositAmount: "1000000000",
    leaseStartAt: now,
    leaseEndAt: now + 864000,
    acceptDeadline: now + 86400,
  },
});
assert.equal(draft.status, 201, JSON.stringify(draft.data));
const leaseId = draft.data.id;
assert.equal((await stranger.request("/api/leases/" + leaseId)).status, 403);
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9kAAAAASUVORK5CYII=",
  "base64",
);
const intent = await owner.request("/api/documents/upload-intent", {
  method: "POST",
  json: {
    leaseId,
    purpose: "terms",
    mime: "image/png",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  },
});
assert.equal(intent.status, 201, JSON.stringify(intent.data));
assert.equal(
  (await owner.request(intent.data.uploadUrl, { method: "PUT", body: bytes }))
    .status,
  200,
);
assert.equal(
  (
    await owner.request(
      "/api/documents/" + intent.data.documentId + "/submit",
      {
        method: "POST",
        json: { uploadId: intent.data.uploadId },
      },
    )
  ).status,
  201,
);
const job = await owner.request("/api/exports", {
  method: "POST",
  json: { leaseId },
});
assert.equal(job.status, 202, JSON.stringify(job.data));
let status;
for (let attempt = 0; attempt < 20; attempt++) {
  status = await owner.request(job.data.statusUrl);
  assert.equal(status.status, 200);
  if (status.data.state === "ready" || status.data.state === "failed") break;
  await setTimeout(1000);
}
assert.equal(status.data.state, "ready", JSON.stringify(status.data));
const grant = await owner.request(job.data.statusUrl + "/access");
assert.equal(grant.status, 200, JSON.stringify(grant.data));
const archive = await owner.request(grant.data.url);
assert.equal(archive.status, 200);
assert.ok(unzipSync(archive.data)["manifest.json"]);
assert.equal(archive.headers.get("cache-control"), "no-store, private");
assert.equal((await stranger.request(grant.data.url)).status, 403);
assert.equal(
  (await owner.request("/api/auth/logout", { method: "POST", json: {} }))
    .status,
  200,
);
assert.equal((await owner.request("/api/leases/" + leaseId)).status, 401);
console.log(
  "PASS HTTP: health, signed SIWE, cross-lease ACL, private upload, automatic export queue, bound ZIP download and logout.",
);
