# Member D Main Review, 2026-10-02

Reviewed GitHub main: 41108c8136c4e4425f6b8ae166fa954158ab22ee. Corrected implementation: cbe41fc14caebe6266647f1070a9978d475ce7ef. The following evidence commit contains this report and the refreshed acceptance JSON. No secrets or real private materials were committed.

## Result And Merge History

D 可独立交付的第一、第二阶段任务已在 main 保留，经过本轮修复与复验。第一阶段经 PR #7 / 0dcc55f 合并，第二阶段经 PR #12 / 41108c8 合并。96dcffc、9bd8bb5、168bda5、c522334、4df78b5、ef600e7 均为 main 的祖先；两个旧分支的 tip 也都已合入。远端两个 D 分支在本轮检查开始时已不存在。

这不等于整个 RB-08、RB-12、RB-13 或公开发布已经验收。C 的两类真机同址恢复、多角色测试网页面流程；E 的主执行器接入、真实到期执行、完整停运恢复与独立复现；实际公网主机 ACL/TLS 与可选托管 Supabase，仍需要相应环境和联合证据。

## D Requirement Check

| D responsibility | Current main evidence | Status and boundary |
| --- | --- | --- |
| SIWE/session/invitations | Real signatures, nonce replay/races, domain/network/time rejection, cookies/CSRF, invitation binding/expiry | Implemented and locally verified; physical passkey recovery is C/joint acceptance |
| Schema/migrations | Immutable migration checksums, fresh/repeated PostgreSQL migrations, RLS, transaction races | Implemented and verified on PGlite and PostgreSQL 16.15 |
| Private materials/ACL | Immutable versions/commitments, current R/F case access, session-bound downloads, cross-lease denial, retention/purge | Implemented and locally verified |
| Scan/quarantine | Actual ClamAV, rejected embedded EICAR PDF, clean promotion, errors/retries/upgrade blocking | Implemented and verified in the selected self-hosted environment |
| Exports | Persistent ZIP jobs, accessible exact originals, manifest/commitment verification, current scan policy | Implemented; real HTTP and private download ACL passed |
| Test Gas | Role/allowlist eligibility, quotas, low balance, persisted signed bytes, exact retry/receipt | Implemented; actual local EVM transfer passed, no public sponsor provisioning claim |
| C support | Existing live API/ABI, persistent scan polling/retry, signed HTTP session/material/export path | D interface verified; complete public browser role journey remains joint |
| E persistence/reorg interface | Canonical deadlines, atomic event/task invalidation, durable signed bytes, competing claims/reconnect, unsigned requeue | D adapter verified; E's existing JSON executor still needs integration |

## Defects Found And Corrected

1. Windows core.autocrlf converted clamd.conf to CRLF after the merge. The real daemon failed with "Incorrect argument format for option TCPSocket". Git now pins this config and its service unit to LF; the actual installed service parses and starts successfully.
2. ClamAV VERSION reports its process-local time without a timezone. The fresh 28141 database appeared at 14:26:12 on Asia/Shanghai and was incorrectly future-dated when interpreted as UTC. Added a persistent systemd unit with TZ=UTC and documented the same requirement for manual runs. The actual response is now 06:26:12 UTC; freshness checks pass without relaxing the age/future checks.
3. When a reorg-cancelled unsigned task's original source became canonical again, enqueue returned its cancelled row and could never claim it. A regression first failed (3 passed / 1 failed). Enqueue now requeues only cancelled rows with no signed bytes, resets attempts/error/old locks, and still validates the current checkpoint/deadline. PGlite and real PostgreSQL two-connection regressions pass; signed/reconcile tasks retain their existing protection.

## Executed Verification

Windows, Node 24.14.1, Ubuntu/WSL PostgreSQL 16.15, ClamAV 1.5.4 with daily 28141 dated 2026-10-02 06:26:12 UTC. The ignored .env.stage-two selects the local PostgreSQL/ClamAV/private-storage environment and loopback HTTP port 3012. Commands below are from apps/web unless marked root.

| Command | Actual result |
| --- | --- |
| npm test | 69 passed, 0 failed, 0 skipped; pinned solc compilation and real local Hardhat EVM included |
| npm run typecheck | Passed after the task fix |
| npm run build | Passed after the task fix; 8 static pages and dynamic API/routes built |
| node --env-file=.env.stage-two --test src/server/tests/postgres.integration.mjs src/server/tests/deployment.integration.mjs | 2 passed, 0 failed, 0 skipped; actual PostgreSQL and ClamAV |
| node --env-file=.env.stage-two --test src/server/tests/deployment.integration.mjs | 1 passed, 0 failed, 0 skipped after adding the returning-canonical-source PostgreSQL assertions |
| node --env-file=.env.stage-two src/server/cli.mjs verify-deployment | Passed: 24 private tables with RLS/no client policies, separated immutable storage, clean accepted/EICAR rejected |
| node --env-file=.env.stage-two src/server/tests/http.integration.mjs | Passed against the production Next server and persistent backend worker: signed SIWE, ACL, quarantine/scan/submit, ZIP, bound download, logout |
| systemd-analyze verify /etc/systemd/system/rentbond-clamd.service | Passed; installed persistent scanner starts with UTC |
| git diff --check; node scripts/check-scaffold.mjs (root) | Passed |
| node tests/runner.mjs all (root) | 5 passed, 0 failed, 12 skipped, native exit code 2; incomplete acceptance, not a pass |

The 69 module tests and two environment tests are distinct from the incomplete 17-case total acceptance suite; repeated tests are not additional coverage counts. Ordinary tests inject a scanner, and deployment task tests inject chain snapshots. Only the named real-engine/local-EVM tests provide those respective execution evidence. Database fixtures use a test administrator and switch to an untrusted role for RLS assertions; they do not certify a production service account or public host filesystem permissions. GitHub-hosted CI, public Monad execution and independent human review were not performed in this review.
