import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { fixture, client, draftBody } from "./helpers.mjs";
import { openDatabase, migrate } from "../db.ts";

test("PostgreSQL: fresh/repeated migration, two-connection nonce/idempotency races and rollback", async (t) => {
  assert.ok(
    process.env.RENTBOND_TEST_DATABASE_URL,
    "Set RENTBOND_TEST_DATABASE_URL to a disposable PostgreSQL database.",
  );
  const root = new pg.Pool({
    connectionString: process.env.RENTBOND_TEST_DATABASE_URL,
  });
  const schema = "member_d_test_" + randomUUID().replaceAll("-", "");
  await root.query("CREATE SCHEMA " + schema);
  const url = new URL(process.env.RENTBOND_TEST_DATABASE_URL);
  url.searchParams.set("options", "-c search_path=" + schema);
  const { app } = await fixture(t, { databaseUrl: url.toString() });
  const second = await openDatabase(app.config);
  t.after(async () => {
    await second.close();
    await root.query("DROP SCHEMA " + schema + " CASCADE");
    await root.end();
  });
  const user = client(app),
    other = client({ ...app, db: second }, user.account);
  const signed = await user.challenge();
  for (const pair of user.jar) other.jar.set(...pair);
  const results = await Promise.all(
    [user, other].map((c) =>
      c.request("/api/auth/verify", { method: "POST", json: signed }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  const winner = results[0].status === 200 ? user : other,
    loser = winner === user ? other : user;
  for (const pair of winner.jar) loser.jar.set(...pair);
  const key = randomUUID(),
    body = draftBody(app);
  const drafts = await Promise.all(
    [user, other].map((c) =>
      c.request("/api/leases/drafts", {
        method: "POST",
        headers: { "idempotency-key": key },
        json: body,
      }),
    ),
  );
  assert.equal(drafts[0].status, 201, JSON.stringify(drafts[0].data));
  assert.equal(drafts[1].data.id, drafts[0].data.id);
  assert.equal((await second.query("SELECT * FROM leases")).length, 1);
  assert.deepEqual(await migrate(second), []);
  await assert.rejects(
    second.transaction(async (sql) => {
      await sql.query("UPDATE leases SET version=99");
      throw new Error("test crash");
    }),
    /test crash/,
  );
  assert.equal(
    (await app.db.query("SELECT version FROM leases"))[0].version,
    1,
  );
  const [migration] = await app.db.query("SELECT * FROM schema_migrations");
  await app.db.query("UPDATE schema_migrations SET checksum='tampered' WHERE name=$1",[migration.name]);
  await assert.rejects(migrate(second), /modified/);
  await app.db.query("UPDATE schema_migrations SET checksum=$1 WHERE name=$2", [
    migration.checksum,migration.name,
  ]);
  t.diagnostic((await root.query("SELECT version()")).rows[0].version);
});
