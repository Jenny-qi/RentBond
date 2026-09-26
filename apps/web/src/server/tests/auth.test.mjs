import test from "node:test";
import assert from "node:assert/strict";
import { fixture, client } from "./helpers.mjs";
import { cookieName, SESSION_IDLE, SESSION_LIFETIME } from "../auth.ts";
import { sha256 } from "../crypto.ts";

test("SIWE: real EOA signatures, nonce replay and concurrent consumption", async (t) => {
  const { app } = await fixture(t);
  const user = client(app),
    signed = await user.challenge();
  const results = await Promise.all(
    [1, 2].map(() =>
      user.request("/api/auth/verify", { method: "POST", json: signed }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  assert.equal((await app.db.query("SELECT * FROM sessions")).length, 1);
  const success = results.find((r) => r.status === 200);
  assert.match(success.response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(success.response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(
    success.response.headers.get("cache-control"),
    "no-store, private",
  );
  const stored = (await app.db.query("SELECT * FROM sessions"))[0];
  assert.notEqual(
    stored.session_hash,
    user.jar.get(cookieName(app.config, "session")),
  );
});

test("SIWE rejects substituted domain, URI, network, statement, future/expired times and invalid signatures", async (t) => {
  const f = await fixture(t),
    { app } = f;
  for (const change of [
    { domain: "attacker.example" },
    { uri: "https://attacker.example" },
    { chainId: 1 },
    { statement: "Transfer funds" },
    { issuedAt: new Date(app.now() + 1000) },
    { expirationTime: new Date(app.now() - 1000) },
  ]) {
    const actor = client(app);
    const result = await actor.request("/api/auth/verify", {
      method: "POST",
      json: await actor.challenge(change),
    });
    assert.equal(result.status, 401, JSON.stringify(change));
  }
  const user = client(app),
    signed = await user.challenge();
  signed.signature = "0x" + "00".repeat(65);
  assert.equal(
    (await user.request("/api/auth/verify", { method: "POST", json: signed }))
      .status,
    401,
  );
  const expires = await user.challenge();
  f.advance(300000);
  assert.equal(
    (await user.request("/api/auth/verify", { method: "POST", json: expires }))
      .status,
    401,
  );
  assert.equal((await app.db.query("SELECT * FROM sessions")).length, 0);
});

test("nonce is bound to browser challenge cookie; HTTPS session cookie is Secure and host-only", async (t) => {
  const { app } = await fixture(t, { origin: "https://rentbond.example" });
  const alice = client(app),
    other = client(app);
  const signed = await alice.challenge();
  assert.equal(
    (await other.request("/api/auth/verify", { method: "POST", json: signed }))
      .status,
    401,
  );
  const login = await alice.request("/api/auth/verify", {
    method: "POST",
    json: signed,
  });
  assert.equal(login.status, 200);
  assert.match(
    login.response.headers.get("set-cookie"),
    /__Host-rentbond-session/,
  );
  assert.match(login.response.headers.get("set-cookie"), /; Secure/);
});

test("idle and absolute session expiration, logout and wallet switch revoke earlier access", async (t) => {
  const f = await fixture(t),
    { app } = f,
    user = client(app);
  await user.login();
  f.advance(SESSION_IDLE);
  assert.equal((await user.request("/api/auth/session")).status, 401);
  await user.login();
  const start = app.now();
  for (let i = 1; i <= 12; i++) {
    f.setNow(start + i * 60 * 60 * 1000);
    assert.equal((await user.request("/api/auth/session")).status, 200);
  }
  const token = user.jar.get(cookieName(app.config, "session"));
  f.setNow(start + SESSION_LIFETIME);
  await app.db.query(
    "UPDATE sessions SET last_seen_at=$1 WHERE session_hash=$2",
    [app.now(), sha256(token)],
  );
  assert.equal((await user.request("/api/auth/session")).status, 401);
  await user.login();
  const old = new Map(user.jar);
  await user.request("/api/auth/logout", { method: "POST", json: {} });
  user.jar.clear();
  for (const pair of old) user.jar.set(...pair);
  assert.equal((await user.request("/api/auth/session")).status, 401);
  await user.login();
  const session = user.jar.get(cookieName(app.config, "session"));
  const replacement = client(app);
  for (const pair of user.jar) replacement.jar.set(...pair);
  await replacement.login();
  assert.equal(
    (
      await app.db.query(
        "SELECT revoked_at FROM sessions WHERE session_hash=$1",
        [sha256(session)],
      )
    )[0].revoked_at !== null,
    true,
  );
});

test("cross-site writes and fetches denied; nonce throttling persists through failed logins", async (t) => {
  const { app } = await fixture(t),
    user = client(app);
  assert.equal(
    (
      await user.request("/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        json: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await user.request("/api/auth/nonce", {
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status,
    403,
  );
  for (let i = 0; i < 30; i++)
    assert.equal((await user.request("/api/auth/nonce")).status, 200);
  const limited = await user.request("/api/auth/nonce");
  assert.equal(limited.status, 429);
  assert.equal(limited.data.error.code, "RATE_LIMITED");
});
