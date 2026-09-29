import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { openDatabase, migrate } from "../db.ts";
import { createStorage } from "../storage.ts";
import { handleApi } from "../api.ts";
import { newCommitment } from "../crypto.ts";
import { TIMEOUT_POLICY } from "../leases.ts";

export const addr = (n) => "0x" + n.toString(16).padStart(40, "0");
export const hash = (n) => "0x" + n.toString(16).padStart(64, "0");
export async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "rentbond-"));
  const config = {
    mode: "local",
    origin: "http://localhost:3000",
    chainId: 31337,
    dataDir: directory,
    sessionSecret: "test-only-" + "x".repeat(48),
    storageBucket: "rentbond-private",
    confirmations: 1,
    gasAmount: 10000000000000000n,
    gasAccountDaily: 3,
    gasLeaseDaily: 8,
    gasGlobalDaily: 100,
    gasCooldownMs: 3600000,
    trustProxy: false,
    gasOrganizers: [],
    factoryAddress: addr(100),
    registryAddress: addr(101),
    ...overrides,
  };
  const db = await openDatabase(config, true);
  assert.deepEqual(await migrate(db), [
    "0001_member_d.sql",
    "0002_new_account_invitations.sql",
  ]);
  assert.deepEqual(await migrate(db), []);
  const snapshots = new Map();
  const profiles = new Map();
  let now = Date.UTC(2026, 8, 26, 12);
  const sent = [];
  const chain = {
    async health() {
      return true;
    },
    async lease(address) {
      assert.ok(
        snapshots.has(address),
        "fixture snapshot must be explicitly configured",
      );
      return structuredClone(snapshots.get(address));
    },
    async profile(id) {
      assert.ok(profiles.has(id));
      return structuredClone(profiles.get(id));
    },
    async creation() {
      return [];
    },
    async transaction() {
      return {};
    },
    async prepareGas() {
      return { raw: "0x01", hash: hash(900) };
    },
    async broadcast(raw) {
      sent.push(raw);
    },
    async receipt() {
      return null;
    },
    async events() {
      return [];
    },
    async blockHash() {
      return hash(500);
    },
    async evidence() {
      return { exists: false, acknowledged: false };
    },
  };
  const app = {
    config,
    db,
    storage: createStorage(config),
    chain,
    now: () => now,
  };
  t.after(async () => {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    app,
    snapshots,
    profiles,
    sent,
    advance: (ms) => {
      now += ms;
    },
    setNow: (value) => {
      now = value;
    },
  };
}
export function client(
  app,
  account = privateKeyToAccount(generatePrivateKey()),
) {
  const jar = new Map();
  async function request(path, options = {}) {
    const headers = new Headers({
      origin: app.config.origin,
      cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      ...options.headers,
    });
    let body;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers.set("content-type", "application/json");
    } else body = options.body;
    if ((options.method ?? "GET") === "POST" && !headers.has("idempotency-key"))
      headers.set("idempotency-key", randomUUID());
    const response = await handleApi(
      app,
      new Request(app.config.origin + path, {
        method: options.method ?? "GET",
        headers,
        body,
      }),
    );
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
    return { response, data, status: response.status };
  }
  async function challenge(overrides = {}) {
    const nonce = await request("/api/auth/nonce");
    assert.equal(nonce.status, 200);
    const data = nonce.data;
    const message = createSiweMessage({
      ...data,
      issuedAt: new Date(data.issuedAt),
      expirationTime: new Date(data.expirationTime),
      address: account.address,
      version: "1",
      ...overrides,
    });
    return { message, signature: await account.signMessage({ message }) };
  }
  async function login() {
    const result = await request("/api/auth/verify", {
      method: "POST",
      json: await challenge(),
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result;
  }
  return {
    account,
    wallet: account.address.toLowerCase(),
    jar,
    request,
    challenge,
    login,
  };
}
export function draftBody(app, extras = {}) {
  const now = Math.floor(app.now() / 1000);
  return {
    title: "Fictional test lease",
    termsText: "Fictional terms for automated testing only.",
    depositAmount: "1000000000",
    leaseStartAt: now,
    leaseEndAt: now + 864000,
    acceptDeadline: now + 86400,
    ...extras,
  };
}
export async function draft(app, landlord, tenant, extras = {}) {
  const created = await landlord.request("/api/leases/drafts", {
    method: "POST",
    json: draftBody(app, extras),
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.id;
  if (tenant) {
    const invite = await landlord.request("/api/leases/" + id + "/invites", {
      method: "POST",
      json: { wallet: tenant.wallet },
    });
    assert.equal(invite.status, 201, JSON.stringify(invite.data));
    const claimed = await tenant.request(
      "/api/invites/" + invite.data.token + "/claim",
      { method: "POST", json: { confirm: true } },
    );
    assert.equal(claimed.status, 200, JSON.stringify(claimed.data));
  }
  return id;
}
export async function deployed(f, landlord, tenant, primary, fallback) {
  const { app } = f;
  const timing = {
    checkoutResponse: "60",
    claim: "60",
    response: "60",
    evidence: "60",
    primary: "60",
    challenge: "60",
    fallbackEvidence: "30",
    fallbackResolver: "60",
    exitNotice: "60",
  };
  const parameters = {
    ruleVersion: "1",
    primaryResolver: primary.wallet,
    fallbackResolver: fallback.wallet,
    token: addr(110),
    maxDeposit: "10000000000",
    maxLeaseEnd: String(Math.floor(app.now() / 1000) + 1000000),
    acceptUntil: String(Math.floor(app.now() / 1000) + 200000),
    timingProfileId: hash(120),
    timeoutPolicy: TIMEOUT_POLICY,
    timing,
  };
  const manifest = {
    schemaVersion: "1.0.0",
    text: "Fictional test resolution service",
    parameters,
  };
  const commitment = newCommitment(manifest),
    profileId = hash(130),
    id = app.config.registryAddress + ":" + profileId;
  await app.db.query(
    "INSERT INTO service_profiles(id,chain_id,registry_address,profile_id,manifest,salt,commitment,reviewed,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8)",
    [
      id,
      app.config.chainId,
      app.config.registryAddress,
      profileId,
      JSON.stringify(manifest),
      commitment.salt,
      commitment.commitment,
      app.now(),
    ],
  );
  const profile = {
    ...parameters,
    profileId,
    serviceTermsHash: commitment.commitment,
  };
  f.profiles.set(profileId, {
    profile,
    status: {
      exists: true,
      primaryAccepted: true,
      fallbackAccepted: true,
      closedForNewFunding: false,
    },
    chainTime: Math.floor(app.now() / 1000),
  });
  const leaseId = await draft(app, landlord, tenant, { serviceProfileId: id });
  const prepared = await landlord.request(
    "/api/leases/drafts/" + leaseId + "/prepare",
    { method: "POST", json: { version: 2 } },
  );
  assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
  const terms = prepared.data.terms,
    address = addr(140 + f.snapshots.size),
    now = Math.floor(app.now() / 1000);
  const snapshot = {
    terms: {
      ...profile,
      registryAddress: app.config.registryAddress,
      leaseId: hash(150 + f.snapshots.size),
      landlord: landlord.wallet,
      tenant: tenant.wallet,
      depositAmount: terms.depositAmount,
      leaseEndAt: String(terms.leaseEndAt),
      hardEndAt: String(terms.hardEndAt),
      acceptDeadline: String(terms.acceptDeadline),
      termsHash: prepared.data.commitment,
      serviceProfileId: profileId,
    },
    accounting: {
      fundedAmount: "1000000000",
      unallocated: "1000000000",
      tenantCredit: "0",
      landlordCredit: "0",
      tenantWithdrawn: "0",
      landlordWithdrawn: "0",
      revision: "1",
    },
    schedule: {
      started: true,
      claimDeadline: String(now + 500),
      responseDeadline: String(now + 600),
    },
    phase: 2,
    activeCase: { exists: false, phase: 0, caseId: "0" },
    claims: [],
    decisions: [],
    chainTime: now,
    blockNumber: "1",
    blockHash: hash(500),
  };
  f.snapshots.set(address, snapshot);
  app.chain.creation = async () => [
    {
      address: app.config.factoryAddress,
      eventName: "LeaseCreated",
      transactionHash: hash(600),
      logIndex: 0,
      blockHash: hash(500),
      blockNumber: "1",
      args: {
        termsHash: prepared.data.commitment,
        landlord: landlord.wallet,
        tenant: tenant.wallet,
        escrow: address,
        leaseId: snapshot.terms.leaseId,
      },
    },
  ];
  const attached = await landlord.request(
    "/api/leases/" + leaseId + "/deployment",
    { method: "POST", json: { transactionHash: hash(600) } },
  );
  assert.equal(attached.status, 200, JSON.stringify(attached.data));
  return { leaseId, address, snapshot };
}
export const png = () =>
  Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9kAAAAASUVORK5CYII=",
      "base64",
    ),
  );
export async function upload(app, actor, leaseId, extra = {}) {
  const { sha256 } = await import("../crypto.ts");
  const bytes = png();
  const intent = await actor.request("/api/documents/upload-intent", {
    method: "POST",
    json: {
      leaseId,
      purpose: "terms",
      mime: "image/png",
      size: bytes.length,
      sha256: sha256(bytes),
      ...extra,
    },
  });
  assert.equal(intent.status, 201, JSON.stringify(intent.data));
  const put = await actor.request(intent.data.uploadUrl, {
    method: "PUT",
    body: bytes,
  });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  const submitted = await actor.request(
    "/api/documents/" + intent.data.documentId + "/submit",
    { method: "POST", json: { uploadId: intent.data.uploadId } },
  );
  assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
  return intent.data;
}
