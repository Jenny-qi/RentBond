# Live lease prerequisites — 2026-10-11

Source baseline: `46defa3`. Read-only diagnostics ran inside the existing Azure
Web container with its current runtime configuration. No role key was obtained,
no credentials were changed and no chain transaction was signed/broadcast.

## Confirmed prerequisites and gaps

| Check | Actual live result | Consequence |
| --- | --- | --- |
| Reviewed backend service profiles | 0 for chain 10143 | The creation UI has no reviewed service to select; draft creation alone does not establish deployability |
| Historical profile | Exists; primary and fallback accepted; open for new funding; unexpired | Chain authorization exists, but does not substitute for the backend's verified service document |
| Historical profile acceptUntil | 1827532800; observed chainTime 1791725362 | Acceptance was still in time at this observation |
| API MON sponsor | Not configured | Automatic test-fee replenishment is unavailable |
| Existing Tenant MockUSD | 0 base units | A new deposit needs operator-supplied test tokens |
| Existing Tenant MON | 497685031130000000 wei (0.49768503113 MON) | The current wallet has test gas; this does not guarantee future fees or provision other accounts |
| MockUSD mint operator | `0x0582932f95ea2c070ffd87E612e585D083831a7A` | Only that account can call mint; backend/frontend cannot mint on its own |
| Factory checkpoint/head | 65,478,408 / 70,123,498 | 4,645,090 historical blocks still remained; Worker was advancing, not caught up |
| Worker signing | Disabled | No automatic deadline transaction execution is claimed |

Existing Tenant: `0x430ba461df226e0eb57e7c5783affecb1bf0b177`.
Token: `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` (six decimals).
Historical profile:
`0x9d11cc21a087da5a3c031200ccd38abd11bc032de76f6b7eb472ea95df6a5467`.
Its recorded service commitment is
`0x12f2ea7fbf6f538d9dffa5bbca7cc7426360de59f594c9eac873a2c5a707279d`.

## Service document handoff

The current checkout contains the public profile ID/commitment and deployment
evidence, but no original service manifest/salt file. Request the original
deployment operator's JSON containing `profileId`, `reviewed: true`,
`manifest: {schemaVersion,text,parameters}` and `salt`. Do not request wallet
private keys or recovery phrases. The existing `profile-import` command first
checks the canonical salted commitment against the live Registry; normal API
selection also validates all parameters, chain, registry, expiry and R/F status.

Copying public addresses into a newly invented service document cannot recover
the original salted commitment. If the original file is unavailable, a new
reviewed profile requires separate R/F acceptance transactions; those are not
performed by this diagnostic. No arbitrary DB approval or placeholder service
was inserted. See the [backend operator instructions](../../apps/web/src/server/README.md)
for the existing import command and required fields.

## Tooling corrections

The first diagnostic evaluated Node from `/app` and could not resolve viem;
the corrected command used `docker exec --workdir /app/apps/web`.
Service/head reads then succeeded, but the token step incorrectly selected
MockUSD from the server-generated three-contract ABI object. It was rerun using
the repository's generated `deployments/abi/MockUSD.json`, and token/operator/
MON reads succeeded. These were diagnostic failures, not application failures.

The previously uncertain bundled storage drill did execute: its private
`inventory.json` records six files, 5,312 bytes, under
`/opt/rentbond/private-storage-drills/run-GG4E1Hzm`. A separate live comparison
of source, restored copy and inventory is recorded in the follow-up below.
This archive stays on the same VM; off-host protection, PostgreSQL recovery,
scheduling, wallet UI, real-device recovery and funds settlement remain
unverified. No complete FR/SC/AT/TS is promoted to Verified.

## Independently confirmed recovery follow-up

The follow-up command recomputed every live and restored file's SHA-256 and
size and compared both sets against the saved inventory. It returned
`fileRecovery: passed`, `files: 6`, `bytes: 5312` and
`sourceAndRestoreMatchInventory: true`. Only the separate restored directory
was read; live data was not replaced. The actual canonical API health again
returned database/storage/quarantine/scanner/RPC all true.

The VM's retained Run Command stdout files contain two exact HTTP-smoke PASS
lines. Together with the completed inventory from the bundled command (which
runs only after successful HTTP exit), this establishes that the final bundled
HTTP/restore run completed despite the portal communication error. This is
retained VM output evidence rather than a successful portal response for that
attempt. It closes the final-script confirmation uncertainty in the preceding
[public API report](2026-10-11-public-api-acceptance.md).
