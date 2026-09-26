import { randomUUID } from "node:crypto";
import { parseSiweMessage } from "viem/siwe";
import { verifyMessage, type Hex } from "viem";
import type { Config } from "./config.ts";
import type { Database, Sql } from "./db.ts";
import { randomToken, sha256 } from "./crypto.ts";
import { ApiFailure, requireThat } from "./errors.ts";

export const SESSION_LIFETIME = 24 * 60 * 60 * 1000;
export const SESSION_IDLE = 2 * 60 * 60 * 1000;
export const NONCE_LIFETIME = 5 * 60 * 1000;
export const LOGIN_STATEMENT =
  "Sign in to RentBond. This does not authorize transactions.";
export interface Session {
  hash: string;
  wallet: string;
  expiresAt: number;
}

export const cookieName = (config: Config, kind: "session" | "nonce") =>
  (config.origin.startsWith("https:") ? "__Host-" : "") + "rentbond-" + kind;
export function cookieValue(
  request: Request,
  name: string,
): string | undefined {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(name + "="));
  return values.length === 1 ? values[0].slice(name.length + 1) : undefined;
}
export function cookie(
  config: Config,
  kind: "session" | "nonce",
  value: string,
  seconds: number,
): string {
  return (
    cookieName(config, kind) +
    "=" +
    value +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
    seconds +
    (config.origin.startsWith("https:") ? "; Secure" : "")
  );
}
export function enforceOrigin(request: Request, config: Config): void {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiFailure(403, "CSRF_REJECTED", "Cross-site request rejected.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    requireThat(
      request.headers.get("origin") === config.origin,
      403,
      "CSRF_REJECTED",
      "Request origin does not match.",
    );
  }
}
export async function rateLimit(
  db: Database,
  scope: string,
  now: number,
  limit: number,
  windowMs: number,
): Promise<void> {
  const count = await db.transaction(async (sql) => {
    const [row] = await sql.query(
      "INSERT INTO rate_limits(scope,count,expires_at) VALUES($1,1,$2) ON CONFLICT(scope) DO UPDATE SET count=CASE WHEN rate_limits.expires_at <= $3 THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at <= $3 THEN $2 ELSE rate_limits.expires_at END RETURNING count",
      [scope, now + windowMs, now],
    );
    return Number(row.count);
  });
  requireThat(
    count <= limit,
    429,
    "RATE_LIMITED",
    "Too many requests. Try again later.",
  );
}
export function clientScope(request: Request, config: Config): string {
  // Proxy headers are untrusted unless the deployment's proxy overwrites them.
  return sha256(
    config.trustProxy
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown"
      : "shared",
  );
}
export async function issueNonce(db: Database, config: Config, now: number) {
  const nonce = randomToken(),
    binding = randomToken();
  await db.query(
    "INSERT INTO siwe_nonces(nonce_hash,binding_hash,origin,chain_id,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
    [
      sha256(nonce),
      sha256(binding),
      config.origin,
      config.chainId,
      now,
      now + NONCE_LIFETIME,
    ],
  );
  return {
    data: {
      nonce,
      domain: new URL(config.origin).host,
      uri: config.origin,
      chainId: config.chainId,
      statement: LOGIN_STATEMENT,
      issuedAt: new Date(now).toISOString(),
      expirationTime: new Date(now + NONCE_LIFETIME).toISOString(),
    },
    cookie: cookie(config, "nonce", binding, NONCE_LIFETIME / 1000),
  };
}
export async function verifyLogin(
  db: Database,
  config: Config,
  request: Request,
  input: { message: string; signature: string },
  now: number,
) {
  let message: ReturnType<typeof parseSiweMessage>;
  try {
    message = parseSiweMessage(input.message);
  } catch {
    throw new ApiFailure(401, "INVALID_SIWE", "Invalid sign-in message.");
  }
  const binding = cookieValue(request, cookieName(config, "nonce"));
  requireThat(
    binding && /^[a-f0-9]{64}$/.test(binding) && message.nonce,
    401,
    "INVALID_NONCE",
    "Sign-in challenge is missing.",
  );
  requireThat(
    message.domain === new URL(config.origin).host &&
      message.uri === config.origin &&
      message.chainId === config.chainId &&
      message.version === "1" &&
      message.statement === LOGIN_STATEMENT &&
      !message.resources?.length &&
      !message.requestId &&
      !message.scheme &&
      message.address &&
      /^0x[0-9a-fA-F]{40}$/.test(message.address),
    401,
    "INVALID_SIWE",
    "Sign-in domain, network or message does not match.",
  );
  requireThat(
    message.issuedAt &&
      message.expirationTime &&
      message.expirationTime.getTime() > now &&
      message.issuedAt.getTime() <= now &&
      (!message.notBefore || message.notBefore.getTime() <= now),
    401,
    "EXPIRED_NONCE",
    "Sign-in challenge expired.",
  );
  let valid = false;
  try {
    valid = await verifyMessage({
      address: message.address,
      message: input.message,
      signature: input.signature as Hex,
    });
  } catch {
    /* Invalid signatures are authentication failures. */
  }
  requireThat(
    valid,
    401,
    "INVALID_SIGNATURE",
    "Signature does not match the account.",
  );
  const wallet = message.address.toLowerCase();
  const token = randomToken();
  await db.transaction(async (sql) => {
    const rows = await sql.query(
      "UPDATE siwe_nonces SET consumed_at=$1 WHERE nonce_hash=$2 AND binding_hash=$3 AND origin=$4 AND chain_id=$5 AND consumed_at IS NULL AND expires_at > $1 AND issued_at=$6 AND expires_at=$7 RETURNING nonce_hash",
      [
        now,
        sha256(message.nonce!),
        sha256(binding),
        config.origin,
        config.chainId,
        message.issuedAt!.getTime(),
        message.expirationTime!.getTime(),
      ],
    );
    requireThat(
      rows.length === 1,
      401,
      "INVALID_NONCE",
      "Sign-in challenge expired or was already used.",
    );
    await sql.query(
      "INSERT INTO users(wallet,created_at) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [wallet, now],
    );
    const previous = cookieValue(request, cookieName(config, "session"));
    if (previous)
      await sql.query(
        "UPDATE sessions SET revoked_at=$1 WHERE session_hash=$2",
        [now, sha256(previous)],
      );
    await sql.query(
      "INSERT INTO sessions(session_hash,wallet,created_at,expires_at,last_seen_at) VALUES($1,$2,$3,$4,$3)",
      [sha256(token), wallet, now, now + SESSION_LIFETIME],
    );
    await audit(sql, wallet, "auth.login", null, now, randomUUID());
  });
  return {
    data: { wallet, expiresAt: now + SESSION_LIFETIME },
    cookies: [
      cookie(config, "session", token, SESSION_LIFETIME / 1000),
      cookie(config, "nonce", "", 0),
    ],
  };
}
export async function getSession(
  sql: Sql,
  config: Config,
  request: Request,
  now: number,
): Promise<Session> {
  const token = cookieValue(request, cookieName(config, "session"));
  requireThat(
    token && /^[a-f0-9]{64}$/.test(token),
    401,
    "UNAUTHORIZED",
    "Sign in to continue.",
  );
  const hash = sha256(token);
  const [row] = await sql.query(
    "UPDATE sessions SET last_seen_at=$1 WHERE session_hash=$2 AND revoked_at IS NULL AND expires_at > $1 AND last_seen_at > $3 RETURNING wallet,expires_at",
    [now, hash, now - SESSION_IDLE],
  );
  requireThat(row, 401, "SESSION_EXPIRED", "Session expired. Sign in again.");
  return { hash, wallet: row.wallet, expiresAt: Number(row.expires_at) };
}
export async function audit(
  sql: Sql,
  actor: string | null,
  action: string,
  resource: string | null,
  now: number,
  requestId: string,
) {
  await sql.query(
    "INSERT INTO audit_log(id,actor,action,resource_id,occurred_at,request_id) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), actor, action, resource, now, requestId],
  );
}
