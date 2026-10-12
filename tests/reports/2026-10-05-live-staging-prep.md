# Live product deployment preparation — 2026-10-05

Base: `4a34c3096e8e28184e4ec9f2ba29096694eddc20` (latest main read at start). Operator: Codex on behalf of the Live product owner. Candidate changes belong to the eventual PR commit; this report does not bind a real network release.

Runtime: Node 24.19.0; installation used pinned pnpm 12.8.1 with the unchanged lockfile. The Docker candidate pins Node 24.14.0. Static Compose validation used official Docker Compose 2.39.4 standalone, without a Docker daemon. No hosting account, domain, credentials or role wallet was used.

| Check | Actual result | Boundary |
| --- | --- | --- |
| `npx --yes pnpm@12.8.1 install --frozen-lockfile --allow-build=esbuild --allow-build=core-js` | Passed | pnpm persisted allowed builds into workspace YAML; that incidental change was reverted, no lockfile/dependency change committed |
| `node --test infra/staging/staging.test.mjs` | 6 passed, 0 skipped | Offline config/privacy checks and real loopback HTTP against a fixture server; not a deployed API/RPC |
| `node infra/staging/check-compose.mjs /tmp/rentbond-compose` | Base and explicit executor overlay passed | Real Compose parser and service exposure/dependency assertions; generated non-secret fixtures only, no container start |
| `sh -n infra/staging/compose.sh infra/staging/entrypoint.sh infra/staging/scanner-start.sh infra/staging/database-init.sh` | Passed | Shell syntax, not real PostgreSQL/ClamAV invocation |
| `npm run typecheck --prefix apps/web` | Passed | Existing app type check |
| `npm run build --prefix apps/web` | Passed | Repeated with explicit testnet public fixture settings to check the production build path; `.test` URLs and fixture addresses are not real deployment evidence |
| `npm run backend:abi --prefix apps/web` | Passed | API ABI regenerated from repository sources with pinned solc; tracked ABI files unchanged |
| `node scripts/check-scaffold.mjs` / `git diff --check` | Passed after link repairs | All remaining FR/SC/AT/TS rows, local links and funds fixture preserved |

During preparation, the existing scaffold check failed because main removed `docs/backlog.md` and `docs/changes.md` while its required-file list and four live Markdown links still referred to them. The patch aligns those references with existing MVP/traceability documents and removes only the deleted RB table expectation, retaining JSON/link validation, 34 FR / 16 SC / 52 AT / 5 TS and funds-fixture conservation checks. It does not suppress failing business tests or restore deleted historical documents.

Current package: runtime-only server secrets, ignored operator environment, Docker context secret exclusions, shared private volume, separate nonsuperuser DB role, ordered migrations, scanner fail-closed, read-only deadline Worker by default, explicit key-file overlay for public deadline execution, optional TLS proxy, and a read-only HTTP smoke which refuses missing RPC/scanning even on HTTP 200.

Not run: Docker image build/start, actual host/domain/TLS, public PostgreSQL/ClamAV/Worker checks, actual external browser/passkey or wallet, Monad DEMO_SHORT deployment/service acceptance, public 700/100/200 → 850/150 or timeout 900/100 and withdrawals, independent reproduction/funds review. No AT/TS is upgraded to Verified. These are release blockers, not facts certified by this preparation PR.
