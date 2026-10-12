# Azure backend and production API forwarding — 2026-10-11

## Completed deployment evidence

The user confirmed transfer of the existing Supabase database connection to
`rentbond-backend`, creation of a backend session secret, and TCP 80/443 exposure.
Azure Run Command wrote a mode-0600 runtime file. No credentials were committed.
The NSG now allows TCP 80/443; SSH, application 3000 and ClamAV 3310 stay private.

Database migration exited 0 after configuring the official Supabase CA from
the project's Database Settings download link. The database connection retains
`sslmode=verify-full` and a read-only CA mount. Certificate verification was not
disabled. A new server-only session signing secret was generated on the VM;
the original Vercel secret was not changed.

Fixed two deployment defects exposed by real startup: `clamdscan` was absent
from the scanner image, and Compose/smoke expected a `data` wrapper even though
the actual health API returns a flat object. The rebuilt scanner and Web
containers are healthy. The deployed scanner found `Eicar-Test-Signature` in
a disposable standard EICAR test file; the test file was removed.

Caddy obtained a public certificate for
`rentbond-api-20261011.eastasia.cloudapp.azure.com`. Curl verified HTTPS without
insecure flags and received all five health fields as `true`.

On the user's fork `hongmingxi65-oss/RentBond`, commit
`fadb609e0683859033743bfe8394270180c21ca7` publishes the tested `next.config.ts`
API rewrite. Vercel Production Config `BACKEND_URL` points at the Azure API.
Deployment `x1RJdsKjAbYTLbv2TDhrAmictZPZ` built in 45 seconds, is Ready, and
the project overview confirms it serves `rentbond.vercel.app`.

Requests from Azure through the actual production frontend returned:

| Endpoint | Actual result |
| --- | --- |
| `/` | 200 HTML |
| `/api/health` | 200; database/storage/quarantine/scanner/RPC all true |
| `/api/auth/session` | 401 UNAUTHORIZED, expected without a signed session |
| `/api/resolvers` | 401 UNAUTHORIZED, expected without a signed session |

Browser inspection confirms the canonical homepage and login page render.
Direct navigation to the backend and generated deployment API URLs was blocked
by this cloud browser (`ERR_BLOCKED_BY_CLIENT`); this is not a site bot block.
The production proxy and TLS were independently checked through VM requests.

## Worker and remaining boundaries

Both Worker containers run. The chain Worker initially failed because the RPC
returned `eth_getLogs is limited to a 100 range`. The VM configuration now uses
`WORKER_BATCH_SIZE=100`, `WORKER_POLL_INTERVAL_MS=1000`, `WORKER_EXECUTE=false`.
A real factory synchronization cycle succeeded, with `caughtUp=false`.
At 12:09 UTC, the persisted checkpoint was 65,052,108, head 70,107,665,
remaining history 5,055,557 blocks. A later read found checkpoint 65,053,908, proving persisted advancement. One
subsequent cycle failure was also logged; continuous catch-up remains incomplete
and public RPC reliability is still a limitation. No chain transaction
was signed or broadcast by this deployment work.

The API Worker is running, but successful real export/gas jobs have not been
claimed. Authenticated cookies, same-passkey recovery on real devices, resolver
acceptance, lease creation/funding and allocation/withdrawal still require
user-owned wallet/device actions and evidence. TS01/TS02/TS05 and existing
FR/SC/AT statuses are not promoted to Verified. VM private file storage still
needs backup/restore acceptance; Azure student credit remains finite.

Local validation: `node --test infra/staging/staging.test.mjs` passed 6/6,
including rejection of incomplete HTTP dependency health and unexpected
redirects. TypeScript and production build of the forwarding configuration
passed in the preceding preparation stage. The live Vercel build also passed.

Operational control remains Azure Run Command. The earlier SSH private-key
download did not produce an available file; no fabricated key link is offered.

The documented public Ankr testnet RPC returned the correct chain ID but also
rejected a 1,000-block log query (code -32062). No paid plan, new account or
RPC switch was made; the verified 100-block configuration remains active.
