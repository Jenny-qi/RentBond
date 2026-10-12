# Live status and publication preparation — 2026-10-12

Read-only checks used the existing Azure runtime; no chain transaction, service
restart, security change or database mutation was performed.

The canonical `https://rentbond.vercel.app/api/health` returned all five checks
true: database, storage, quarantine, scanner and RPC. Azure reported the VM
running; its Web and scanner containers were healthy. The diagnostic returned:

| Check | Result |
| --- | --- |
| Runtime application origin | https://rentbond.vercel.app |
| Chain head | 70,256,132 |
| Factory checkpoint | 70,256,114 |
| Distance to head | 18 blocks |
| Stored service profiles on chain 10143 | 0 |
| Tenant MockUSD | 1,000,000,000 base units = 1,000 MockUSD |
| Web runtime sponsor configured | false |

The historical backlog is essentially caught up at this observation; this is
not proof of future indexer availability or automatic deadline execution. Tenant
is `0x430ba461df226e0eb57e7c5783affecb1bf0b177`; token is
`0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1`. The balance independently confirms
the user's previous Remix mint/query screenshot; no new mint was performed.

The authenticated Vercel project `prj_bWRLihVJP0PFlUXMS6ESV6uVO78S` binds
`rentbond.vercel.app` as verified Production. Latest Production deployment is
`dpl_x1RJdsKjAbYTLbv2TDhrAmictZPZ`, READY, built from
`hongmingxi65-oss/RentBond` main at `fadb609e0683859033743bfe8394270180c21ca7`.
The other two user-mentioned domains were not found under this account; their
ownership remains unverified. No domain was reassigned.

## Local review preparation

Fetched the user's fork main read-only and merged it into the local recovery
branch without conflicts. The API-forwarding config agrees with the fork's
published version. Local regression checks passed 7 tests with zero failures
or skips (HTTP smoke target guard, startup diagnostics, bounded Worker ranges).
The scaffold check passed 400 files; `git diff --check` passed.

An attempted push of the local recovery branch to the user's fork was rejected
by automatic approval review because the configured remote is Jenny-qi/RentBond
and publication to the exact fork/branch was not considered authorized. No
alternate publication path was used; no PR was created. The local change set
and review description are ready for explicit target approval.

Service-document JSON/salt, MetaMask classification review, real-device login
and the complete public lease/funding/allocation/withdrawal flow remain blocked
or unverified. No FR/SC/AT/TS is promoted to Verified.
