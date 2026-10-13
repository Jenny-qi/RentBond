# RentBond

### A little more certainty, a long way from home.

**Rental deposit settlement on Monad — built for Monad Metropolis Hackathon 2026.**

[Explore the prototype](https://rentbond.vercel.app) · [Watch the pitch](https://youtu.be/h71RmMy1oiY) · [Watch the technical demo](https://youtu.be/bVPK5qdfrH8) · [Watch the Mera demo](https://youtu.be/N4KVgY5eHyY)

Leaving home takes courage. But courage shouldn't mean facing every uncertainty alone.

For someone moving abroad to study, work, or build a new life, a rental deposit can mean months of living expenses, a family's support, and a small sense of security far from home. When a single deduction puts the whole deposit on hold, that uncertainty becomes personal.

We built RentBond around a simple belief:

> **One disputed charge shouldn't hold up an entire deposit.**

RentBond helps tenants and landlords agree on clear rules before funding, review deductions individually, and settle undisputed amounts once the claim window has closed and allocation is confirmed. Contested claims follow the review process both sides accepted in advance.

**Human reviewers assess the evidence. Smart contracts enforce the agreed payment rules.**

The aim is clarity for both sides: tenants can understand and respond to each deduction, while landlords can present evidence and receive accepted or awarded amounts.

> **Prototype note:** RentBond uses MockUSD, a test token with no cash value. The settlement example below illustrates the intended workflow. Public-testnet operations, real-device recovery, and production readiness require separate verification. See the [acceptance record](docs/acceptance.md) for current evidence and remaining checks.

## Watch RentBond in action

Start with the pitch for the story, the technical demo for the settlement walkthrough, or the Mera demo for the account experience. Click a thumbnail or title to watch on YouTube.

| Pitch · 1:58 | Technical demo · 2:03 | Mera demo · 1:21 |
| --- | --- | --- |
| [![RentBond pitch video](https://img.youtube.com/vi/h71RmMy1oiY/hqdefault.jpg)](https://youtu.be/h71RmMy1oiY) | [![RentBond technical demo](https://img.youtube.com/vi/bVPK5qdfrH8/hqdefault.jpg)](https://youtu.be/bVPK5qdfrH8) | [![RentBond Mera integration demo](https://img.youtube.com/vi/N4KVgY5eHyY/hqdefault.jpg)](https://youtu.be/N4KVgY5eHyY) |
| [**A Little More Certainty, a Long Way from Home**](https://youtu.be/h71RmMy1oiY) | [**One Dispute Shouldn't Freeze an Entire Deposit**](https://youtu.be/bVPK5qdfrH8) | [**Familiar Access, Explicit Control**](https://youtu.be/N4KVgY5eHyY) |
| Why we built RentBond and who we hope to help. | A walkthrough of itemized deductions and partial-dispute settlement. | Passkey access, terms confirmation, and explicit token approval. |

The Mera recording shows the approval step; token approval alone does not mean the deposit has been funded. Videos accompany the project evidence and do not replace transaction receipts or acceptance checks.

## How it works

1. **Agree before funding.** Tenant and landlord confirm the same terms, deposit amount, deadlines, and primary and fallback reviewers. Both reviewers must have authorized the selected service profile before funding.
2. **Review deductions individually.** The landlord submits an itemized claim list with evidence references. The tenant accepts or disputes each item; silence is not acceptance.
3. **Separate what can be settled.** After the claim window closes and allocation is confirmed, unclaimed funds become claimable by the tenant and accepted deductions by the landlord. The disputed portion stays in the agreed process.
4. **Resolve the remaining claims.** Human review, a challenge to the fallback reviewer, or mutual settlement can determine the remaining allocation. Fixed deadlines and a final exit rule keep unresolved funds from being held indefinitely.
5. **Withdraw allocated funds.** Each party receives funds at their fixed beneficiary address. A withdrawal is complete only after its transaction is confirmed.

RentBond is designed for people renting abroad and the private landlords or small property managers who serve them. Both parties must agree to use it **before the deposit is funded**; it cannot recover a deposit already paid outside the contract. Adoption by these users remains a hypothesis to validate.

---

## One deposit. Two deductions. Only one dispute.

Alice deposits **1,000 MockUSD**. At move-out, her landlord claims **100 MockUSD** for cleaning and **200 MockUSD** for damage. Alice accepts the cleaning charge and disputes the damage claim.

| After the claim window closes and allocation is confirmed | Amount (MockUSD) | Status |
| --- | ---: | --- |
| Unclaimed portion → Alice | 700 | Claimable |
| Accepted cleaning charge → landlord | 100 | Claimable |
| Disputed damage claim | 200 | Awaiting resolution |

If the primary reviewer awards 50 of the disputed 200 MockUSD to the landlord and returns 150 to Alice, the final allocation is **850 MockUSD to Alice and 150 MockUSD to the landlord**, once the challenge window ends without a challenge and the result is finalized.

If neither reviewer produces an effective result within the agreed deadlines, the fixed timeout path returns the remaining disputed amount to Alice: **900 MockUSD to Alice and 100 MockUSD to the landlord** in total. Previously allocated amounts remain intact.

Before the claim window closes, any split is an estimate. **Allocated, claimable, and withdrawn are distinct states**; funds count as withdrawn only after each withdrawal transaction confirms. All amounts in this example are test assets with no cash value.

[Demo script](docs/contest/demo.md) · [Deployment and chain evidence](deployments/README.md)

## Familiar access with Mera

RentBond integrates **Mera passkey accounts** into its account and transaction flows: account creation and same-address recovery, Sign-In with Ethereum (SIWE), and signing transactions the user explicitly confirms. Recovery no longer depends on cached browser data or a manually entered wallet address.

Token approval and deposit funding are displayed as separate steps. A pending transaction is not shown as a completed payment, and creating a different passkey does not recover the original account or its lease permissions.

Real-device prompt counts, compatible cross-device recovery, and the complete Monad testnet settlement flow remain subject to acceptance checks. Mera provides the client-side signing account; this project does not implement ERC-4337, a Paymaster, or fiat payments. Test transaction fees use a limited MON top-up service.

**Track:** Consumer Products & Payments. **Sponsor award target:** Best Mera-Powered UX on Monad / Monad Foundation. See the [track and evidence mapping](docs/contest/track-fit.md) for implementation details and outstanding verification.

## The people behind RentBond

We're a team of **six students and working professionals**, brought together by different backgrounds and a shared purpose: making an unfamiliar journey feel a little less uncertain.

Technology cannot remove every fear that comes with starting over. We hope RentBond can make one part of that journey clearer, fairer, and easier to navigate — for tenants and landlords alike.

**To everyone brave enough to begin again, far from home: you deserve peace of mind, too.**

---

## Technology stack

| Layer | Technology | Version |
| --- | --- | --- |
| Smart contracts | Solidity + Foundry | solc 0.8.24 / Forge 1.7.1 |
| Web3 client | viem | 2.56.9 |
| Frontend | Next.js + React | 15.5.26 / 19.1.4 |
| Type checking | TypeScript | 5.9.2 |
| Workspace management | pnpm | 12.8.1 |
| Runtime | Node.js | 24.14.0 |
| Database | PostgreSQL + PGlite | 16 / 0.5.8 |
| Passkey-derived EVM signing accounts | @category-labs/mera | 0.2.0 |
| End-to-end testing | Playwright | 1.62.1 |
| PDF generation | jsPDF | 4.2.1 |
| Runtime schema validation | Zod | 4.6.5 |

See [pnpm-lock.yaml](pnpm-lock.yaml) for the full dependency tree.

---

## Run locally

### Prerequisites

- Node.js 24.x (24.14.0 recommended)
- pnpm 12.8.1
- Git

### Install

```sh
git clone https://github.com/Jenny-qi/RentBond.git
cd RentBond
pnpm install --allow-build=esbuild --allow-build=core-js
```

### Initialize and start

```sh
npm run backend:abi --prefix apps/web
npm run backend:init --prefix apps/web
npm run db:migrate --prefix apps/web
npm run backend:seed --prefix apps/web
npm run dev --prefix apps/web
```

Open `http://localhost:3000`.

These commands start the web application and backend. Transactions also require a local chain or verified testnet RPC, Factory, and service profile. See the [Web setup guide](apps/web/README.md) for environment variables and the [backend guide](apps/web/src/server/README.md) for the database, file scanning, and Worker. The [test guide](tests/README.md) covers a walkthrough that starts a temporary local chain and web server; historical testnet addresses are not an accepted DEMO_SHORT environment.

The root scripts `infra:up`, `chain:local`, `contracts:deploy:local`, `dev`, and `build` remain explicit failing placeholders. Use the module commands above and the linked setup guides.

### Test commands

```sh
pnpm --filter @rentbond/web exec playwright install --with-deps chromium
node tests/runner.mjs integration
node tests/runner.mjs e2e
npm run test:contracts
```

These are commands to run, not a claim that the current checkout passes every test. Consult the [acceptance record](docs/acceptance.md) and [blocker log](docs/blocker-log.md) for dated results and unresolved checks.

### Windows setup notes

The first pnpm installation needs explicit permission for the esbuild and core-js build scripts:

```sh
pnpm install --allow-build=esbuild --allow-build=core-js
```

Check that Node is 24.x with `node --version`.

---

## Monad integration and evidence

RentBond targets **Monad testnet (chain ID: 10143)** using its EVM-compatible execution environment.

### Historical deployment · September 26, 2026

| Contract | Address |
| --- | --- |
| MockUSD (test asset) | `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` |
| ResolverRegistry | `0x61f13f0c0DAaC2802EeD3Cd4DD9FD67c93d0ce30` |
| DepositEscrowDeployer | `0x7E717703E2bf6cF0b7562DA8cdEb718e65A4f13f` |
| LeaseFactory | `0x6ed49Bf8EE5E9ba2cbE2977fe100342Fe2999a7E` |
| Example DepositEscrow | `0x80753a6Dd914177fE8AD8cE28B325Fe1B677C479` |

### Chain evidence

- Lease creation: `0x70f948a33e3af390cf53458b192ab6276ae5cac4a60414121bee8c40fcb8cafe`
- Funding of 1,000 MockUSD: `0xf7e1cfef92efa9ba94fcffc94a7d66e5dde6c53ba19eedadce2ff1e1590286fa`
- [Chain snapshot and verification record](deployments/monad-testnet-2026-09-26.chain-evidence.json)

These are historical deployment and funding records from September 26, 2026. The snapshot reports `readyForFrontend: false`; it does not establish completion of the public-testnet 850/150 or 900/100 allocation and withdrawal flows, or verify the current hosted prototype's configuration.

### Why Monad

- **EVM compatibility:** Solidity contracts and familiar development tools fit the project's settlement rules.
- **Consumer transaction flow:** Creating a lease, submitting claims, confirming allocations, and withdrawing funds require multiple transactions, making transaction cost and responsiveness relevant to the experience.
- **Testnet prototyping:** MockUSD lets the team demonstrate the workflow without putting real rental deposits at risk.

---

## Project structure

```
RentBond/
├── apps/
│   ├── web/          # Next.js frontend and backend API
│   └── worker/       # Standalone event sync and deadline Worker
├── contracts/        # Solidity contracts and Foundry tests
├── packages/
│   └── shared/       # Shared types, amount utilities, network config
├── deployments/      # Deployment records and verification snapshots
├── tests/
│   ├── integration/  # Integration tests
│   └── e2e/          # Playwright browser tests
├── scripts/          # Development and operations scripts
└── docs/             # Architecture, interfaces, acceptance, submission
```

---

## Third-party components

| Component | Purpose | License |
| --- | --- | --- |
| OpenZeppelin Contracts 5.0.2 | Contract utilities, including ReentrancyGuard | MIT |
| Next.js 15 / React 19 | Web framework | MIT |
| viem 2.56.9 | EVM interactions | MIT |
| @category-labs/mera | Passkey account integration | MIT |
| Foundry | Contract compilation and testing | MIT |
| Playwright | Browser automation | Apache-2.0 |
| jsPDF 4.2.1 | PDF exports | Apache-2.0 |
| Zod 4.6.5 | Runtime schema validation | MIT |

Third-party code retains its own license; the project's MIT license does not relicense those components. Full dependencies, including transitive dependencies, are recorded in [pnpm-lock.yaml](pnpm-lock.yaml).

---

## AI assistance disclosure

The team used AI coding tools during development:

| Tool | Scope | Contributor role |
| --- | --- | --- |
| Claude Code (Anthropic) | Code generation, refactoring, debugging, technical documentation | E |
| GitHub Copilot | Code completion | C/D |
| OpenAI Codex | README and submission documentation; backend, permissions, scanning, tests and fixes; account recovery, sessions, and track evidence | A/D |

Contributor letters refer to the engineering ownership roles in [docs/team.md](docs/team.md), not the full team roster. Members still need to confirm their own tool usage, reused components, and human review records.

**AI does not adjudicate disputes in RentBond.** Passing automated checks does not establish a complete human review or an independent funds audit.

---

## License

Original project code is released under the [MIT License](LICENSE).

Copyright (c) 2026 RentBond contributors.

---

## Documentation

Detailed engineering and acceptance documents are primarily in Chinese.

- [Product scope and MVP specification](docs/MVP-SPEC.md)
- [Architecture](docs/architecture.md)
- [Acceptance checklist](docs/acceptance.md)
- [Known blockers](docs/blocker-log.md)
- [Contract interfaces](docs/interfaces/contracts.md)
- [Hackathon submission requirements](docs/contest/contest-requirements.md)
- [Demo script](docs/contest/demo.md)
- [Deployment and recovery](docs/runbooks/deployment.md)
