# Public API and storage checks — 2026-10-11

Implementation baseline: `d60d60e`, with test tooling delivered in the commit
containing this report. The actual Azure application image and business rules
were not changed by these API checks.

## Confirmed live service checks

Executed in the Azure Web container:
`node /app/apps/web/src/server/cli.mjs verify-deployment`.
Actual output: PostgreSQL, 24 private tables with RLS enabled and no client
policies, isolated private objects/quarantine, ClamAV 1.4.3/28150 with fresh
definitions, EICAR rejected, clean fixture accepted. Immutable writes and
byte-preserving storage round trips were also checked. The existing verifier
cleaned up its own temporary objects.

## Confirmed public HTTP slice

Executed from Azure through the actual canonical Vercel origin:

```sh
RENTBOND_TEST_BASE_URL=https://rentbond.vercel.app \
RENTBOND_TEST_PUBLIC_ORIGIN=https://rentbond.vercel.app \
node /app/apps/web/.public-api-smoke/http.integration.mjs --public-testnet
```

Azure returned the complete PASS line. Assertions passed for health, two
temporary-account SIWE logins, site/domain/chain ID 10143, Secure/HttpOnly/
SameSite=Strict cookies, fictional draft creation, cross-account lease
rejection, private PNG upload, actual scanning queue reaching clean, explicit
submission, actual export queue reaching ready, ZIP manifest and unchanged
original hash, private no-store headers, session-bound ZIP download,
cross-account download rejection, both logouts and post-logout rejection.

The fictional draft has no deployed escrow or deposit. Submitted file and
export records remain under the temporary accounts. No real lease was changed
or deleted. Temporary keys/cookies were not saved or printed. No chain
transaction was signed or broadcast. This did not operate or bypass MetaMask
and does not certify Mera or the wallet UI.

The first tooling invocation could not create its directory as the container
user; test-directory creation was rerun as root while the HTTP script ran as
the existing default user. A later bundled invocation had a delimiter error
before execution; the next retry returned a portal communication error. Those
uncertain/failed attempts are not additional passing evidence. Final
same-origin/no-redirect hardening was added after the confirmed HTTP pass;
separate live confirmation is required before claiming the final script passed.

## Local checks and remaining boundaries

The target-guard tests passed 2/2, with no failures or skips. HTTP script syntax,
storage drill shell syntax and `git diff --check` passed. Public writes remain
disabled by default. The guard rejects an unacknowledged or insecure public
origin, credentials and hidden path/query/fragment components.

`private-storage-drill.sh` restores into a separate same-VM directory and
compares all file sizes/hashes, without replacing live data. Its live result
is not yet established. Off-host backup, PostgreSQL recovery, available service
profiles, gas sponsor configuration, history catch-up, physical-device recovery
and public funds settlement remain separate work. No FR/SC/AT/TS is promoted
to Verified.

Follow-up: retained VM stdout contains two HTTP PASS lines, and an independently
verified six-file recovery inventory exists from the final bundled command.
The final run therefore completed despite its portal error. Same-host file
restoration and ongoing API health are now confirmed; see the
[lease-readiness follow-up](2026-10-11-lease-readiness.md). Off-host/database
recovery and wallet/funds acceptance remain unverified.
