import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { randomUUID } from "node:crypto";
import { handleApi } from "./api.ts";

/** Public test keys used only for fictional local fixtures, never persisted by the server. */
export async function seedLocal(app) {
  if (app.config.mode !== "local")
    throw new Error("Fixtures require local mode.");
  const actors = [1, 2].map((n) => ({
    account: privateKeyToAccount("0x" + n.toString(16).padStart(64, "0")),
    cookies: new Map(),
  }));
  const call = async (actor, path, body) => {
    const headers = {
      origin: app.config.origin,
      cookie: [...actor.cookies].map(([k, v]) => k + "=" + v).join("; "),
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    };
    const response = await handleApi(
      app,
      new Request(app.config.origin + path, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const [k, v] = cookie.split(";")[0].split("=");
      actor.cookies.set(k, v);
    }
    const data = await response.json();
    if (!response.ok)
      throw new Error("Fixture API failed: " + data.error?.code);
    return data;
  };
  for (const actor of actors) {
    const challenge = await call(actor, "/api/auth/nonce");
    const message = createSiweMessage({
      ...challenge,
      address: actor.account.address,
      version: "1",
      issuedAt: new Date(challenge.issuedAt),
      expirationTime: new Date(challenge.expirationTime),
    });
    await call(actor, "/api/auth/verify", {
      message,
      signature: await actor.account.signMessage({ message }),
    });
  }
  const now = Math.floor(app.now() / 1000);
  const lease = await call(actors[0], "/api/leases/drafts", {
    title: "Fictional local lease",
    termsText: "Fictional local demonstration only. No cash value.",
    depositAmount: "1000000000",
    leaseStartAt: now,
    leaseEndAt: now + 30 * 86400,
    acceptDeadline: now + 7 * 86400,
  });
  const invite = await call(actors[0], "/api/leases/" + lease.id + "/invites", {
    wallet: actors[1].account.address,
  });
  await call(actors[1], "/api/invites/" + invite.token + "/claim", {
    confirm: true,
  });
  for (const actor of actors) await call(actor, "/api/auth/logout", {});
  return {
    fixtureOnly: true,
    leaseId: lease.id,
    landlord: actors[0].account.address,
    tenant: actors[1].account.address,
    deployed: false,
    funded: false,
  };
}
