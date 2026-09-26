import { randomUUID } from "node:crypto";
import { keccak256, stringToHex } from "viem";
import { z } from "zod";
import type { Context } from "./context.ts";
import type { Row } from "./db.ts";
import { canonicalJson, newCommitment, randomToken, sha256 } from "./crypto.ts";
import {
  draftFields,
  patchDraft,
  inviteSchema,
  type DraftFields,
} from "./schemas.ts";
import { leaseAccess, verifyManifest } from "./acl.ts";
import { requireThat } from "./errors.ts";
import { audit } from "./auth.ts";

export const TIMEOUT_POLICY = keccak256(
  stringToHex("TIMEOUT_RETURN_UNAWARDED_TO_TENANT"),
);
export async function checkedProfile(ctx: Context, id: string) {
  const [stored] = await ctx.sql.query(
    "SELECT * FROM service_profiles WHERE id=$1 AND reviewed=true AND chain_id=$2",
    [id, ctx.app.config.chainId],
  );
  requireThat(
    stored,
    422,
    "INVALID_SERVICE",
    "Select a reviewed test service.",
  );
  verifyManifest(stored);
  requireThat(
    stored.registry_address === ctx.app.config.registryAddress?.toLowerCase(),
    409,
    "INVALID_SERVICE",
    "Registry does not match this environment.",
  );
  const { profile, status, chainTime } = await ctx.app.chain.profile(
    stored.profile_id,
  );
  requireThat(
    status.exists &&
      status.primaryAccepted &&
      status.fallbackAccepted &&
      !status.closedForNewFunding &&
      Number(profile.acceptUntil) > chainTime &&
      profile.serviceTermsHash === stored.commitment &&
      profile.timeoutPolicy === TIMEOUT_POLICY,
    409,
    "SERVICE_UNAVAILABLE",
    "Service is not eligible for new leases.",
  );
  // The private, salted service document must bind every parameter accepted on chain.
  const expected = { ...profile };
  delete expected.profileId;
  delete expected.serviceTermsHash;
  const privateParameters = { ...stored.manifest.parameters };
  for (const field of ["primaryResolver", "fallbackResolver", "token"]) {
    expected[field] = String(expected[field]).toLowerCase();
    privateParameters[field] = String(privateParameters[field]).toLowerCase();
  }
  requireThat(
    canonicalJson(privateParameters) === canonicalJson(expected),
    409,
    "COMMITMENT_MISMATCH",
    "Service parameters differ from its private document.",
  );
  return { stored, profile, chainTime };
}
async function terms(ctx: Context, input: DraftFields, tenant?: string) {
  requireThat(
    input.leaseEndAt > input.leaseStartAt &&
      input.acceptDeadline > Math.floor(ctx.now / 1000) &&
      input.acceptDeadline < input.leaseEndAt,
    422,
    "INVALID_DATES",
    "Invalid lease dates or acceptance deadline.",
  );
  requireThat(
    !input.tenant || input.tenant !== ctx.session.wallet,
    422,
    "INVALID_ROLES",
    "Tenant and landlord must differ.",
  );
  let service: Row | null = null;
  let hardEndAt: number | null = null;
  if (input.serviceProfileId) {
    const { stored, profile } = await checkedProfile(
      ctx,
      input.serviceProfileId,
    );
    requireThat(
      BigInt(input.depositAmount) <= BigInt(profile.maxDeposit) &&
        input.leaseEndAt <= Number(profile.maxLeaseEnd) &&
        input.acceptDeadline <= Number(profile.acceptUntil),
      422,
      "OUTSIDE_SERVICE_SCOPE",
      "Lease exceeds service limits.",
    );
    const parties = [
      ctx.session.wallet,
      tenant ?? input.tenant,
      profile.primaryResolver.toLowerCase(),
      profile.fallbackResolver.toLowerCase(),
    ].filter(Boolean);
    requireThat(
      new Set(parties).size === parties.length,
      422,
      "INVALID_ROLES",
      "All lease roles must use different accounts.",
    );
    service = { registryAddress: stored.registry_address, ...profile };
    hardEndAt =
      input.leaseEndAt +
      [
        "claim",
        "response",
        "evidence",
        "primary",
        "challenge",
        "fallbackResolver",
        "exitNotice",
      ].reduce((sum, field) => sum + Number(profile.timing[field]), 0);
  }
  return {
    schemaVersion: "1.0.0",
    ...input,
    tenant: tenant ?? input.tenant ?? null,
    landlord: ctx.session.wallet,
    chainId: ctx.app.config.chainId,
    timeoutPolicy: TIMEOUT_POLICY,
    hardEndAt,
    service,
  };
}
export async function createDraft(ctx: Context, body: unknown) {
  const input = draftFields.parse(body),
    value = await terms(ctx, input);
  const id = randomUUID(),
    commitment = newCommitment(value);
  await ctx.sql.query(
    "INSERT INTO leases(id,landlord,terms,salt,commitment,chain_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      ctx.session.wallet,
      JSON.stringify(value),
      commitment.salt,
      commitment.commitment,
      ctx.app.config.chainId,
      ctx.now,
    ],
  );
  await ctx.sql.query(
    "INSERT INTO lease_members(lease_id,wallet,role) VALUES($1,$2,'L')",
    [id, ctx.session.wallet],
  );
  await audit(
    ctx.sql,
    ctx.session.wallet,
    "lease.draft.create",
    id,
    ctx.now,
    ctx.requestId,
  );
  return {
    id,
    version: 1,
    terms: value,
    ...commitment,
    deploymentReady: false,
  };
}
export async function updateDraft(ctx: Context, id: string, body: unknown) {
  const input = patchDraft.parse(body),
    lease = await leaseAccess(ctx, id, ["L"]);
  requireThat(
    !lease.contract_address && !lease.prepared_at,
    409,
    "DRAFT_FROZEN",
    "Prepared or deployed terms cannot be edited.",
  );
  requireThat(
    input.version === lease.version,
    409,
    "VERSION_CONFLICT",
    "Draft changed. Reload the latest version.",
  );
  const fields = draftFields.parse({
    ...Object.fromEntries(
      Object.keys(draftFields.shape)
        .filter((k) => lease.terms[k] != null)
        .map((k) => [k, lease.terms[k]]),
    ),
    ...Object.fromEntries(
      Object.entries(input).filter(([k]) => k !== "version"),
    ),
  });
  requireThat(
    !lease.tenant || !fields.tenant || fields.tenant === lease.tenant,
    409,
    "TENANT_ALREADY_JOINED",
    "Joined tenant cannot be replaced.",
  );
  const value = await terms(ctx, fields, lease.tenant ?? undefined),
    commitment = newCommitment(value);
  await ctx.sql.query(
    "UPDATE leases SET terms=$1,salt=$2,commitment=$3,version=version+1 WHERE id=$4 AND version=$5",
    [
      JSON.stringify(value),
      commitment.salt,
      commitment.commitment,
      id,
      input.version,
    ],
  );
  return { id, version: input.version + 1, terms: value, ...commitment };
}
export async function createInvite(ctx: Context, id: string, body: unknown) {
  const input = inviteSchema.parse(body),
    lease = await leaseAccess(ctx, id, ["L"]);
  requireThat(
    !lease.contract_address && !lease.prepared_at && !lease.tenant,
    409,
    "DRAFT_FROZEN",
    "Tenant assignment is already fixed.",
  );
  const expectedWallet = input.wallet ?? lease.terms.tenant ?? null;
  requireThat(
    expectedWallet !== lease.landlord &&
      (!lease.terms.tenant || expectedWallet === lease.terms.tenant),
    422,
    "INVALID_ROLES",
    "Invitation does not match the intended tenant.",
  );
  const token = randomToken(),
    expiresAt = Math.min(
      ctx.now + input.expiresInSeconds * 1000,
      lease.terms.acceptDeadline * 1000,
    );
  requireThat(
    expiresAt > ctx.now,
    409,
    "INVITE_EXPIRED",
    "Lease acceptance deadline has passed.",
  );
  await ctx.sql.query(
    "INSERT INTO invites(token_hash,lease_id,expected_wallet,expires_at,created_at) VALUES($1,$2,$3,$4,$5)",
    [sha256(token), id, expectedWallet, expiresAt, ctx.now],
  );
  return {
    token,
    leaseId: id,
    expiresAt,
    url: ctx.app.config.origin + "/invite/" + token,
  };
}
export async function acceptInvite(ctx: Context, token: string) {
  const [invite] = await ctx.sql.query(
    "SELECT * FROM invites WHERE token_hash=$1 AND claimed_at IS NULL AND expires_at > $2",
    [sha256(token), ctx.now],
  );
  requireThat(
    invite &&
      (!invite.expected_wallet ||
        invite.expected_wallet === ctx.session.wallet),
    403,
    "FORBIDDEN",
    "Invitation is invalid for this account.",
  );
  const [lease] = await ctx.sql.query(
    "SELECT * FROM leases WHERE id=$1 FOR UPDATE",
    [invite.lease_id],
  );
  verifyManifest(lease);
  requireThat(
    !lease.contract_address && !lease.prepared_at && !lease.tenant,
    409,
    "DRAFT_FROZEN",
    "Tenant assignment is already fixed.",
  );
  requireThat(
    lease.landlord !== ctx.session.wallet,
    422,
    "INVALID_ROLES",
    "Landlord cannot claim the tenant role.",
  );
  const service = lease.terms.service;
  requireThat(
    !service ||
      ![
        service.primaryResolver.toLowerCase(),
        service.fallbackResolver.toLowerCase(),
      ].includes(ctx.session.wallet),
    422,
    "INVALID_ROLES",
    "Tenant cannot also be a resolver.",
  );
  const value = { ...lease.terms, tenant: ctx.session.wallet },
    commitment = newCommitment(value);
  await ctx.sql.query(
    "UPDATE leases SET tenant=$1,terms=$2,salt=$3,commitment=$4,version=version+1 WHERE id=$5",
    [
      ctx.session.wallet,
      JSON.stringify(value),
      commitment.salt,
      commitment.commitment,
      lease.id,
    ],
  );
  await ctx.sql.query(
    "INSERT INTO lease_members(lease_id,wallet,role) VALUES($1,$2,'T')",
    [lease.id, ctx.session.wallet],
  );
  await ctx.sql.query(
    "UPDATE invites SET claimed_at=$1,claimed_by=$2 WHERE token_hash=$3",
    [ctx.now, ctx.session.wallet, sha256(token)],
  );
  await audit(
    ctx.sql,
    ctx.session.wallet,
    "invite.claim",
    lease.id,
    ctx.now,
    ctx.requestId,
  );
  return {
    leaseId: lease.id,
    version: lease.version + 1,
    termsAccepted: false,
  };
}
export async function prepareDraft(ctx: Context, id: string, body: unknown) {
  const { version } = z
    .object({ version: z.number().int().positive() })
    .strict()
    .parse(body);
  const lease = await leaseAccess(ctx, id, ["L"]);
  requireThat(
    !lease.contract_address && lease.version === version,
    409,
    "VERSION_CONFLICT",
    "Draft changed or is already deployed.",
  );
  requireThat(
    lease.tenant &&
      lease.terms.serviceProfileId &&
      lease.terms.service &&
      ctx.app.config.factoryAddress,
    422,
    "DRAFT_INCOMPLETE",
    "A joined tenant, current test service and factory are required.",
  );
  const { profile, chainTime } = await checkedProfile(
    ctx,
    lease.terms.serviceProfileId,
  );
  requireThat(
    lease.terms.acceptDeadline > chainTime &&
      lease.terms.leaseEndAt <= Number(profile.maxLeaseEnd),
    409,
    "INVALID_DATES",
    "Lease acceptance deadline has passed.",
  );
  await ctx.sql.query(
    "UPDATE leases SET prepared_at=COALESCE(prepared_at,$1) WHERE id=$2",
    [ctx.now, id],
  );
  return {
    id,
    version,
    terms: lease.terms,
    salt: lease.salt,
    commitment: lease.commitment,
    chainId: ctx.app.config.chainId,
    factory: ctx.app.config.factoryAddress,
    functionName: "createLease",
    args: [
      {
        serviceProfileId: profile.profileId,
        tenant: lease.tenant,
        landlord: lease.landlord,
        depositAmount: lease.terms.depositAmount,
        leaseEndAt: String(lease.terms.leaseEndAt),
        termsHash: lease.commitment,
        acceptDeadline: String(lease.terms.acceptDeadline),
      },
    ],
    requiresWalletConfirmation: true,
  };
}
