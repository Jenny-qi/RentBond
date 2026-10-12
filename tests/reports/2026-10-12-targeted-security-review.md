# Targeted security review and dependency patch — 2026-10-12

Scope: canonical https://rentbond.vercel.app/, production baseline fadb609e0683859033743bfe8394270180c21ca7, wallet login/client/server authentication paths and homepage-listed assets. This is a targeted review, not an independent security audit or complete product acceptance.

## Findings

- External-wallet login requests accounts, checks chain and selected address, obtains a browser-bound nonce, and signs a SIWE message bound to the site domain/URI and configured chain. The inspected login path does not call token approval or transfer methods.
- Server authentication verifies domain, URI, chain, statement, nonce, time bounds and signature. Financial writes use separate explicit confirmation and simulation/receipt checks.
- The inspected homepage returned 200 without redirect and listed 11 same-origin scripts; all 11 fetched successfully. This does not cover every lazy-loaded route or prove absence of malicious behavior.
- The publicly retrieved MetaMask eth-phishing-detect configuration did not contain the exact canonical domain or a matching parent block entry at inspection time. Other providers were not verified. The observed MetaMask malicious-site warning remains unresolved, and its cause is unknown.
- Changing a selected wallet does not establish the account attached to an existing request. The application consumes the first address returned by the wallet and separately checks it; the previously observed Tenant request and later Account 1 screenshot alone do not establish a current mismatch.

## Dependency correction

The pre-patch production dependency audit returned seven advisory records (three high, four moderate) across Next.js, PostCSS and source-map-js. Advisory presence does not establish applicability or exploitation, and does not establish the reason for MetaMask classification. In particular, the Next.js GHSA-4jqv-mc3x-m676 advisory concerns self-hosted Pages Router behavior and explicitly excludes Vercel deployments.

- Next.js 15.5.26 -> 15.5.27.
- PostCSS pinned to 8.5.28 and source-map-js to 1.2.2 through root pnpm workspace overrides; the previous app-local npm override was not governing pnpm resolution.
- Keep npm manifest overrides aligned and regenerate both lockfiles.
- Record permitted core-js/esbuild build scripts using pnpm workspace allowBuilds, matching existing CI installation flags.

## Validation

- `npm exec --yes --package=pnpm@12.8.1 -- pnpm install --frozen-lockfile --allow-build=esbuild --allow-build=core-js`: exit 0.
- `pnpm audit --prod --json`: exit 0, empty advisories, zero vulnerabilities at all severities (112 reported dependencies).
- `npm run typecheck --prefix apps/web`: exit 0.
- From apps/web: `node --test src/server/tests/auth*.test.mjs src/features/live/client.test.mjs`: 13 passed, zero failed/skipped.
- `npm run build --prefix apps/web`: exit 0 with Next.js 15.5.27.

## Outstanding

Patch is prepared on the recovery branch; production has not been upgraded by this work. No wallet warning bypass, role signature, chain transaction, merge or production deployment was performed. MetaMask/provider manual review, full public user-device funds acceptance and off-host backup remain outstanding. No FR/SC/AT/TS status is promoted.

References: https://support.metamask.io/configure/wallet/security-alerts ; https://github.com/MetaMask/eth-phishing-detect ; https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676
