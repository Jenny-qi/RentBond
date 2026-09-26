# Member D Requirements Review, 2026-09-27

This review checks the D delivery against GitHub main d26ddab, docs/team.md, the RB-08/09/10/11/12 backlog, PRD chapters 7/8/9/12 and the acceptance matrix. GitHub's issue listing contained PRs #1-6, not a separate member-D issue with additional acceptance criteria. PR #6 is still open and its testnet evidence is not an end-to-end D release.

The original 48 passing tests did not establish complete requirement coverage. This review reproduced five failing regression tests before fixing the implementation. It does not claim perfection or independent security certification.

## Findings And Changes

| Severity | Finding before this review | Correction and regression coverage |
| --- | --- | --- |
| P1 | hardEndAt rejected test Gas even when T/L still needed to exit or withdraw funded balances | Retain quotas and let funded T/L with outstanding balances receive Gas after the deadline; closed leases and post-deadline resolvers remain excluded |
| P1 | Case reads filtered out tenant claim-response statements and the original checkout request because those were created before a case ID existed | Include confirmed claim responses for CLAIMS and the exact preceding confirmed checkout request for CHECKOUT; retain private drafts and earlier-case exclusion |
| P1 | Resolver file ACL/export omitted supporting originals attached to confirmed claims and responses unless users submitted another case bundle | Reuse the same case reference calculation for downloads and exports; test current-case originals, tenant counter-evidence, unrelated files and pre-escalation F |
| P2 | RPC failover only helped when eth_chainId failed; a primary answering chain ID but failing later reads blocked access | Use viem fallback transport over endpoints that passed chain validation; mismatched chains still disable access |
| P2 | PRD FR-11/12 and 8.3 had no capture-time field, append-only evidence withdrawal note, or optional response counter-evidence | Add capturedAt, evidence-withdrawal and response documents; preserve originals, hashes and explicit onChain state |
| P2 | D branch had not incorporated current B/E handoffs and conflicted with main in three files | Merge main d26ddab, preserve B's deployment scripts and E's Worker changes; compare generated D ABI semantics with B's published bundle |
| P2 | B's inherited read-only evidence tests passed URL.pathname to Node, producing C:\C:\... on Windows | Convert file URLs with fileURLToPath; all five inherited checks now run and pass on Windows |

## Requirements Check

| Requirement | D implementation/evidence | Completion boundary |
| --- | --- | --- |
| RB-08 / PRD 12.1 / TS03 / AT28 | Real signed SIWE, domain/URI/chain/time checks, atomic nonce, session/logout/CSRF; auth tests and HTTP smoke | Implemented and locally exercised; real passkey device recovery belongs to joint TS05 |
| FR-06 / RB-09 | Versioned drafts, limited invitations, joined tenant, frozen terms, verified Factory attachment | Implemented; C's real page integration still needed |
| FR-10/11/12/34 / AT33/35 | Immutable files/bundles, exact acknowledgement, capture timestamps, appended withdrawal notes, hash validation | Implemented; on-chain acknowledgement does not establish truth |
| FR-17/18/21 / RB-10 | Private claims, optional counter-evidence, immutable initial amounts/reasons and later evidence bundles | Implemented; direct contract confirmation still required |
| FR-24/28 / AT27/44 | Current and confirmed R/F assignment, case-limited history/download/export | Implemented; caller cannot enlarge case scope or use an old role/link |
| FR-33 / RB-11 | Persistent ZIP jobs, originals/digests/salts, case history, canonical events, assertions distinguished from chain records | Implemented and locally exercised |
| Schema/migration / PRD 9.2/12.3 | PGlite/PostgreSQL migrations, immutable rows, RLS default deny, encrypted idempotency results, sessions/audit | Initial PostgreSQL two-pool evidence remains in the 2026-09-26 report; this review changes no SQL migration |
| AT43 / RB-08 | Bounded sponsor, durable signed bytes/hash, receipt confirmation, deadline exit eligibility | Local EVM and quota/retry tests; actual public sponsor provisioning not claimed |
| RB-12 D handoff / SC-01/04 | Durable events/checkpoints/jobs, reorg invalidation, RPC failover and public ABI compatibility | D modules implemented; E's full persistent scheduler integration and public finality acceptance remain open |
| PRD 9.4 public uploads | Type/size/hash limits, private storage, attachment isolation | Malware scanning/quarantine before public access remains a release gate; not falsely marked complete |
| TS04/05 / AT41/42/51 / RB-13 | Prior same-machine clean clone and local signature/withdrawal tests | Independent review, real-device recovery, full UI/API/Worker and outage recovery remain unverified |

## Validation

Environment: Windows, Node 24.14.1, Next 15.5.26, viem 2.56.9, PGlite 0.5.8, solc 0.8.24 and Hardhat 3.18.0. All commands below ran after the relevant fixes.

| Command/check | Actual result |
| --- | --- |
| npm test --prefix apps/web | 53 passed, 0 failed, 0 skipped: 32 D backend and 21 existing C tests |
| npm run typecheck --prefix apps/web | Passed |
| npm run build --prefix apps/web | Passed, including dynamic API route |
| npm audit --prefix apps/web | 0 reported vulnerabilities |
| node scripts/check-scaffold.mjs | Passed; links/schema/counts only, not business acceptance |
| node --test scripts/verify-monad-evidence.test.mjs | 5 passed after the Windows path fix; local simulated RPC, not a public testnet query |
| RENTBOND_TEST_BASE_URL=http://localhost:3000 node src/server/tests/http.integration.mjs (from apps/web) | Passed against the production Next server: SIWE, ACL, upload, automatic export and logout |
| B/D ABI semantic comparison | Passed for all three API ABIs |
| git diff --check | Passed for the review changes |

The five new tests are in apps/web/src/server/tests/review.test.mjs. The existing real EVM test now also sends a tenant response transaction, checks its case visibility and original-file access before an extra case upload, and obtains sponsor MON after hardEndAt before fixed-beneficiary withdrawals. The original four requirements tests and the additional RPC test failed before their fixes; the five inherited evidence tests initially failed on the Windows URL conversion. Those failures are retained here rather than reclassified.

D's DepositEscrow, ResolverRegistry and LeaseFactory ABIs are semantically identical to the published B bundle (112, 29 and 17 entries respectively); JSON ordering differs. The reviewed production Solidity sources are identical between the original D branch and main d26ddab.

No public deployment, paid cloud purchase, public file upload or message to another member was performed. This branch is deliverable for review, not evidence that main has merged it or that all 52 acceptance scenarios have passed.
