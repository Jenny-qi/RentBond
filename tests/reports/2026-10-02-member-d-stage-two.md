# Member D Stage Two, 2026-10-02

Source baseline: GitHub main b664c0ace75a5604c1c2a61842dbb642b79f6714 (which already includes PR #7 and C's live API implementation). Delivery branch: feat/member-d-stage-two. This report accompanies the implementation; its fixed implementation commit is added below after committing the reviewed tree. No additional open non-PR GitHub issues were returned during this review.

## Progress For The Team

D：已在最新主分支基础上完成第二阶段可独立交付部分。补齐 ClamAV 私有隔离扫描、C 上传扫描等待/重试、旧材料重新扫描与旧导出阻断；新增 E 可调用的持久化任务、签名交易落库、并发锁和链回滚接口。真实 PostgreSQL + ClamAV 环境下验证了 EICAR PDF 拒绝、干净文件提交/导出、匿名与跨用户 ACL、多连接任务抢占和重新连接恢复；会话、材料、导出、Gas 的本地真实 EVM 回归继续通过。Web 68 项、部署依赖集成 2 项均通过且无跳过，生产构建与真实 HTTP 冒烟通过。

待联合验收：E 将主执行器从 jobs.json 切换到新接口，完成真实到期执行与完整停运恢复；C/E 完成浏览器多角色流程和两类真机同址恢复；实际公众主机另复验域名、TLS、进程/目录权限和链终局性。可选 Supabase 托管项目没有冒充已验证。当前无需购买云服务或 VPS。

## Requirement Evidence

| User requirement | Implemented delivery | Evidence and boundary |
| --- | --- | --- |
| C real sessions/materials/exports/Gas | Existing signed SIWE and live API retained; Materials now consumes persistent scan status and stops on page/account changes | HTTP against Next + real PostgreSQL/ClamAV; local EVM session/material/export/sponsor regression; not physical passkey recovery or full public-chain UI |
| E persistent tasks/event rollback | Migration 0003; E-facing backend.mjs; canonical checkpoint/deadline validation, idempotent enqueue, token claims, signed bytes before broadcast, receipt validation and reorg reconciliation | 3 adapter tests plus two-connection PostgreSQL claim/reconnect test; E's main executor is still separate |
| Scanning and quarantine before public upload | Separate local directories/private buckets; ClamAV INSTREAM with fresh definitions; size/hash/type recheck; only clean digest-matched bytes promoted | 7 scan/protocol/client tests plus real ClamAV EICAR and embedded-PDF tests; no injected scanner is described as antivirus evidence |
| Upgrade and retention | Legacy originals pending rescan; old ZIPs invalidated; public mode cannot reuse bypass exports; expiry and purge remove both copies | Migration/reopen regression, old-original rescan and old-export denial; migration is append-only |
| Selected environment ACL | Native PostgreSQL 16.15, local private storage, ClamAV 1.5.4 | Actual untrusted PostgreSQL role cannot read private tables even after SELECT grants; INSERT rejected by RLS; other API users cannot read lease/scan/ZIP |
| Honest acceptance | Mixed passed/skipped suites now exit 2 | Total suite remains incomplete: 5 passed / 12 skipped; these are not added to the 70 passing module/environment tests |

## Executed Checks

Windows / Node 24.14.1; Next 15.5.26, viem 2.56.9, PGlite 0.5.8, solc 0.8.24, Hardhat 3.18.0. Native services: Ubuntu/WSL, PostgreSQL 16.15 and ClamAV 1.5.4. Real scanner reported daily definition 28140 dated Thu Oct 1 14:24:38 2026 and passed freshness checks.

Commands are run from apps/web unless a root path is specified. The ignored .env.stage-two selects a disposable PostgreSQL database, FILE_SCAN_MODE=clamav, CLAMAV_HOST=127.0.0.1 and the local HTTP origin at port 3012. No credentials or private materials are included in this report.

| Command | Result |
| --- | --- |
| npm test | 68 passed, 0 failed, 0 skipped (42 server/integration-boundary tests plus 26 existing C tests); pinned Solidity compilation included |
| npm run typecheck | Passed |
| npm run build | Passed; all 8 static pages generated and API/dynamic routes built |
| node --env-file=.env.stage-two --test src/server/tests/postgres.integration.mjs src/server/tests/deployment.integration.mjs | 2 passed, 0 failed, 0 skipped, real PostgreSQL and real ClamAV |
| node --env-file=.env.stage-two src/server/cli.mjs verify-deployment | Passed: 24 private tables with RLS/no client policies, isolated immutable storage, fresh definitions, clean accepted/EICAR rejected |
| node --env-file=.env.stage-two src/server/tests/http.integration.mjs | Passed: real HTTP signed SIWE, cross-lease ACL, quarantine/scan/submit, persistent export worker, bound ZIP, logout |
| npm audit --omit=dev --prefix apps/web (root) | 0 production dependency vulnerabilities reported |
| node scripts/check-scaffold.mjs (root) | Passed after delivery documentation added |
| node tests/runner.mjs all (root) | 5 passed, 0 failed, 12 skipped; exit 2, incomplete acceptance |

The normal module suite injects a scanner in ordinary file tests; only the explicit deployment check uses the real engine. Its E scheduling snapshots remain test fixtures. The separate Hardhat test executes real local transactions. None of these is a Monad public deployment, a public sponsor provisioning claim, or independent security review.

## Review Corrections And Environment Limits

- C previously submitted immediately after PUT; the new pipeline blocks until scan completion and retains the intent for retry instead of creating another version just to poll.
- Prior exports could otherwise bypass the upload upgrade; migration invalidates them and current policy is checked again when granting/downloading.
- Scan ownership and bounded attempts protect restart/concurrent workers; a stale worker cannot override a newer rejection. Old unsubmitted uploads are explicitly read from their legacy location.
- The first format-aware antivirus fixture appended EICAR text to a PNG and was not detected. Replaced it with a valid PDF carrying an EICAR attachment, which real ClamAV rejects. Antivirus scanning is not a proof that every malicious document is detectable.
- The total runner originally returned 0 with a mixture of passes/skips. The corrected runner returns 2 whenever any requirement is skipped. CI no longer translates exit 2 back to success, and its integration job now also runs the Web regression suite. GitHub-hosted CI was not executed during local verification; E still owns the existing pnpm installation/version setup and unimplemented E2E scenarios.
- Docker Desktop failed to initialize its inference socket. No Docker validation is claimed for this turn. Native Ubuntu packages were used instead; Windows reserved port 5432 required a loopback-only local service bridge to the WSL PostgreSQL service. Both native services remain private; no public deployment was performed.
- Disposable PostgreSQL fixtures use a local test administrator; the RLS assertions explicitly switch to an untrusted role. This does not certify a production service account or host filesystem ACL. A deployed service must use its dedicated database account and restricted filesystem permissions.
- No npm package was added. The existing pnpm workspace migration, full E executor, public RPC/finality, independent acceptance and physical devices remain their owners' follow-up work.
