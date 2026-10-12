import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { unzipSync } from "fflate";
import { smokeTarget } from './http-smoke-target.mjs';

const { origin, publicTest } = smokeTarget(process.env, process.argv.slice(2));
// Creates fictional records only; never creates, funds or updates a chain contract.
function actor() {
  const account = privateKeyToAccount(generatePrivateKey());
  const jar = new Map();
  async function request(path, { method = "GET", json, body } = {}) {
    const url = new URL(path, origin);
    assert.equal(url.origin, origin, 'Never send test credentials to another origin.');
    const headers = {
      origin,
      cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      "idempotency-key": randomUUID(),
    };
    if (json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect: 'error',
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
    if (publicTest) {
      assert.equal(nonce.data.chainId, 10143, 'Public smoke requires Monad testnet.');
      assert.equal(nonce.data.domain, new URL(origin).host);
      assert.equal(nonce.data.uri, origin);
      const cookies = nonce.headers.getSetCookie();
      assert.ok(cookies.some((cookie) => /;\s*Secure(?:;|$)/i.test(cookie) &&
        /;\s*HttpOnly(?:;|$)/i.test(cookie) && /;\s*SameSite=Strict(?:;|$)/i.test(cookie)));
    }
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
    if (publicTest) assert.ok(result.headers.getSetCookie().some((cookie) =>
      cookie.startsWith('__Host-rentbond-session=') && /;\s*Secure(?:;|$)/i.test(cookie) &&
      /;\s*HttpOnly(?:;|$)/i.test(cookie) && /;\s*SameSite=Strict(?:;|$)/i.test(cookie)));
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
    title: publicTest ? "Fictional public API smoke lease" : "Fictional HTTP smoke lease",
    termsText: publicTest ? "Automated API test only. No real tenancy or deposit." : "Local automated test only.",
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
let scan;
for (let attempt = 0; attempt < 45; attempt++) {
  scan = await owner.request(intent.data.statusUrl);
  assert.equal(scan.status, 200, JSON.stringify(scan.data));
  if (["clean", "rejected"].includes(scan.data.scanStatus)) break;
  await setTimeout(1000);
}
assert.equal(scan.data.scanStatus, "clean", JSON.stringify(scan.data));
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
assert.ok(Object.values(unzipSync(archive.data)).some((entry) =>
  createHash('sha256').update(entry).digest('hex') === createHash('sha256').update(bytes).digest('hex')),
  'Archive must contain the unchanged submitted fixture.');
assert.equal(archive.headers.get("cache-control"), "no-store, private");
assert.equal((await stranger.request(grant.data.url)).status, 403);
assert.equal(
  (await owner.request("/api/auth/logout", { method: "POST", json: {} }))
    .status,
  200,
);
assert.equal((await owner.request("/api/leases/" + leaseId)).status, 401);
assert.equal((await stranger.request('/api/auth/logout', { method: 'POST', json: {} })).status, 200);
console.log(
  "PASS HTTP: health, temporary-account SIWE, cross-lease ACL, private upload, automatic export queue, unchanged ZIP fixture, bound download and logout. " +
  (publicTest ? 'Public Monad testnet API only; no wallet UI or chain transactions. Fictional draft/file/export records retained.' : 'Local environment.'),
);
