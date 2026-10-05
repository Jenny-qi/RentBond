<<<<<<< HEAD
# RentBond — Programmable Rental Deposit Settlement

> **Dispute 200, not your entire 1,000 deposit.**

RentBond 在区块链上运行租房押金结算：房东逐项提出扣款，租客逐项认可或争议。申索窗口关闭后，无争议资金立即可领，争议部分按双方预先接受的程序处理。

**Monad 测试网 · MockUSD 测试资产，无现金价值。**

---

## 演示场景

租客 Alice 存入 **1,000 MockUSD**，退租时房东申索清洁费 100、损坏费 200。Alice 认可清洁费，争议损坏费。

| 申索窗口关闭后 | 金额 | 状态 |
| --- | ---: | --- |
| 未申索部分 → 租客 | 700 | 可领取 |
| 已认可扣款 → 房东 | 100 | 可领取 |
| 有争议扣款 | 200 | 待处理 |

若处理人裁决 50 给房东、150 给租客，挑战期结束后租客获得 850、房东获得 150。

[演示脚本](docs/contest/demo.md) · [链上证据](deployments/README.md)

---

## 技术栈

| 层次 | 技术 | 版本 |
| --- | --- | --- |
| 合约 | Solidity + Foundry | solc 0.8.24 / Forge 1.7.1 |
| Web3 客户端 | viem | 2.56.9 |
| 前端框架 | Next.js + React | 15.5.26 / 19.1.4 |
| 类型检查 | TypeScript | 5.9.2 |
| 工作区管理 | pnpm | 12.8.1 |
| 运行时 | Node.js | 24.14.0 |
| 数据库 | PostgreSQL + PGlite | 16 / 0.5.8 |
| 账户抽象 | @category-labs/mera | 0.2.0 |
| 端到端测试 | Playwright | 1.52.0 |
| PDF 生成 | jsPDF | 4.2.1 |
| 合约验证 | Zod | 4.6.5 |

完整依赖见 [pnpm-lock.yaml](pnpm-lock.yaml)。

---

## 本地运行

### 前置要求

- Node.js 24.x（建议 24.14.0）
- pnpm 12.8.1
- Git

### 安装

```sh
git clone https://github.com/Jenny-qi/RentBond.git
cd RentBond
pnpm install --allow-build=esbuild --allow-build=core-js
```

### 初始化

```sh
npm run backend:abi --prefix apps/web    # 生成合约 ABI
npm run backend:init --prefix apps/web   # 初始化数据库
npm run db:migrate --prefix apps/web     # 运行迁移
npm run fixtures:seed --prefix apps/web  # 加载示例数据（虚构）
npm run dev --prefix apps/web            # 启动 Web 服务
```

访问 `http://localhost:3000`。

### 完整测试

```sh
pnpm --filter @rentbond/web exec playwright install --with-deps chromium
node tests/runner.mjs integration        # 集成测试
node tests/runner.mjs e2e                # 端到端浏览器测试
npm run test:contracts                   # 合约测试（需 Foundry）
```

### Windows 特殊说明

pnpm 首次安装时需要显式允许构建脚本：

```sh
pnpm install --allow-build=esbuild --allow-build=core-js
```

如果 `node --check src/main.ts` 报错，确认 Node 版本为 24.x：`node --version`。

---

## Monad 集成

RentBond 运行于 **Monad 测试网（chainId: 10143）**，使用 EVM 兼容执行环境。

### 已部署合约

| 合约 | 地址 |
| --- | --- |
| MockUSD（测试资产） | `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` |
=======
# RentBond — Programmable Deposit Settlement

> **Dispute 200, not your entire 1,000 deposit.**

RentBond 帮助跨境租客与小型房东远程结算租房押金：房东逐项提出扣款，租客逐项认可或争议。申索窗口关闭并完成链上分配后，无争议资金可先领取，争议部分继续按双方预先接受的程序处理。

**Monad 测试网原型 · MockUSD 测试资产，无现金价值。** 核心流程已有本地自动化测试；测试网完整结算、真实设备恢复及独立验收仍待完成。

## 为什么做 RentBond

退租后离开当地的租客，仍需要与房东核对扣款、交换材料和等待结算。RentBond 将每项扣款、双方回应、处理期限与资金状态放在同一流程中，让一项争议不必拖住已经可以分配的其余押金。房东也能提交清楚的扣款依据，获得已认可或有效处理结果支持的款项。

首批目标是海外学生、海外工作者、陪读／随迁家庭，以及服务这些租客的私人房东和小型物业。这是待验证的用户假设，目前没有真实采用数据。

**使用前提：双方在入金前接受规则，并把押金存入租约合约。** RentBond 无法追回此前已交给房东的押金。

## 核心演示：1,000 → 700 / 100 / 200

虚构租客 Alice 存入 1,000 MockUSD。退租时，房东申索清洁费 100、桌面损坏费 200；Alice 认可清洁费，对原有划痕提出争议。

| 申索窗口关闭并确认分配后 | 金额（MockUSD） | 状态 |
| --- | ---: | --- |
| 未申索部分 → 租客 | 700 | 可领取 |
| 已认可扣款 → 房东 | 100 | 可领取 |
| 有争议的扣款 | 200 | 待处理 |

处理人若支持争议款中 50 给房东，结果经过挑战期并生效后，最终租客获得 850、房东获得 150。另一条演示路径中，主、备用处理均超时，按事先接受的退出规则最终分配为 900 / 100。

页面区分 **预计拆分 → 可领取 → 已领取**。申索窗口关闭前不提前分配未申索部分；授权代币不等于入金；分配不等于到账。上述流程已有本地浏览器测试，尚无完整 Monad 测试网分配与领取验收。

[三角色演示脚本](docs/contest/demo.md) · [部署与链上证据](deployments/README.md) · [本地浏览器测试报告](tests/reports/2026-10-03-browser-e2e.md)

公开体验地址和演示视频尚未提供。正式投稿需提供公开可观看、**不超过 3 分钟**的视频，展示实际操作及 Monad 链上交互；本地测试录像不能替代 Monad 集成证据。

## 链上规则与技术实现

合约将双方事先同意的金额、受益人和期限绑定到已存入的押金，平台不能通过修改数据库转走资金。数据库负责私有材料和协作记录，链上负责资金状态与执行规则。链上记录不判断照片真伪，也不保证处理人判断公平。

| 层 | 实现 |
| --- | --- |
| 合约 | Solidity / Foundry；服务预授权 Registry、租约 Factory、每份租约独立 Escrow |
| 网页与账户 | Next.js / React / TypeScript / viem；Mera passkey 接入、SIWE 会话、本人交易确认 |
| 数据与材料 | PostgreSQL / 本地 PGlite；私有文件、版本承诺、访问控制、ClamAV 扫描及导出 |
| Worker | 独立 Node.js 进程；事件同步、持久化到期任务、重放与重启恢复 |
| 验证 | Foundry、Node 测试、Playwright Chromium、本地 EVM 与链上只读核验 |

每份租约仅一个租客和一个房东，最多 10 项申索，收款人固定。合约不可升级，无管理员提款、平台费、收益或 AI 裁决。主处理、备用处理、双方和解与固定超时退出均保留；正常配置的最终退出点为租约到期后 37 天。演示短时配置必须单独标注 `DEMO_SHORT`。

## 如何使用 Monad

RentBond 在 Monad 测试网上执行租约创建、MockUSD 入金、扣款回应、结果生效和领取。项目使用其 EVM 执行环境承载 Solidity 资金状态机，并通过 viem、JSON-RPC 和合约事件将网页操作与可核验的资金记录连接起来。逐项回应和多阶段结算需要多次交易；交易成本与确认等待是选择和验证网络时关注的体验指标，本项目尚未提供性能实测，不宣称独有性能优势。

下列地址来自仓库保存的 **2026-09-26 只读核验快照**，网络为 Monad Testnet，chainId 为 `10143`。它们是已有部署证据，不是已验收的 DEMO_SHORT 发布配置；正式视频必须标明其实际使用的地址。

| 合约 | 地址 |
| --- | --- |
| MockUSD | `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` |
>>>>>>> a6716a7e67120714bd6b241b5f5c5d8f9ad0f1b8
| ResolverRegistry | `0x61f13f0c0DAaC2802EeD3Cd4DD9FD67c93d0ce30` |
| DepositEscrowDeployer | `0x7E717703E2bf6cF0b7562DA8cdEb718e65A4f13f` |
| LeaseFactory | `0x6ed49Bf8EE5E9ba2cbE2977fe100342Fe2999a7E` |
| 示例 DepositEscrow | `0x80753a6Dd914177fE8AD8cE28B325Fe1B677C479` |

<<<<<<< HEAD
### 链上证据

- 创建租约 + 入金 1,000 MockUSD：`0xf7e1cfef92efa9ba94fcffc94a7d66e5dde6c53ba19eedadce2ff1e1590286fa`
- [链上快照与核验记录](deployments/monad-testnet-2026-09-26.chain-evidence.json)

### 为什么选择 Monad

- **EVM 兼容**：无需学习新语言，现有 Solidity 工具链直接迁移
- **低 Gas 成本**：多阶段结算（创建→申索→确认→领取）需要多次链上操作，低 Gas 可行
- **测试网可用**：公开测试网已上线，合约可自由部署和验证

---

## 项目结构

```
RentBond/
├── apps/
│   ├── web/          # Next.js 前端 + 后端 API
│   └── worker/       # 独立 Node.js 事件同步与到期任务 Worker
├── contracts/        # Solidity 合约源码 + Foundry 测试
├── packages/
│   └── shared/       # 共享类型、金额处理、网络配置
├── deployments/      # 链上部署记录与核验快照
├── tests/
│   ├── integration/  # 集成测试
│   └── e2e/          # Playwright 浏览器端到端测试
├── scripts/          # 开发与运维脚本
└── docs/             # 架构、接口、验收、比赛文档
```

---

## 外部依赖

| 库 | 用途 | 许可证 |
| --- | --- | --- |
| OpenZeppelin Contracts 5.0.2 | ReentrancyGuard 等组件 | MIT |
| Next.js 15 / React 19 | Web 框架 | MIT |
| viem 2.56.9 | EVM 交互 | MIT |
| @category-labs/mera | Passkey 账户接入 | MIT |
| Foundry | 合约编译与测试 | MIT |
| Playwright | 浏览器自动化测试 | Apache-2.0 |
| jsPDF 4.2.1 | PDF 导出 | Apache-2.0 |
| Zod 4.6.5 | 运行时类型校验 | MIT |

第三方代码保留各自许可证，不因本项目采用 MIT 而重新授权。完整依赖及传递依赖见 [pnpm-lock.yaml](pnpm-lock.yaml)。

---

## AI 辅助说明

本项目使用 AI 编码工具辅助开发：

| 工具 | 使用范围 | 成员 |
| --- | --- | --- |
| Claude Code (Anthropic) | 代码生成、重构、调试、技术文档 | E |
| GitHub Copilot | 代码补全 | C/D |
| OpenAI Codex | README 与提交文档编辑 | A |

所有 AI 生成代码均经团队成员审核。AI 不参与产品内的争议裁决。

---

## 许可证

本项目原创代码采用 [MIT License](LICENSE)。

Copyright (c) 2026 RentBond contributors.

---

## 文档

- [产品范围与规格](docs/MVP-SPEC.md)
- [架构设计](docs/architecture.md)
- [验收清单](docs/acceptance.md)
- [合约接口](docs/interfaces/contracts.md)
- [比赛提交要求](docs/contest/contest-requirements.md)
- [演示脚本](docs/contest/demo.md)
- [部署与恢复](docs/runbooks/deployment.md)
=======
已有入金交易：`0xf7e1cfef92efa9ba94fcffc94a7d66e5dde6c53ba19eedadce2ff1e1590286fa`。源码关联、部署块、回执及核验边界见[链上快照](deployments/monad-testnet-2026-09-26.chain-evidence.json)与[部署说明](deployments/README.md)。该笔入金不证明后续分配和领取已完成。

MockUSD 为团队测试资产，不由赛事组织者或赞助方发行、认可或批准。

## 已有验证与当前边界

以下为仓库保存的测试结果，不代表每次打开本页时重新运行，也不等于独立安全审计。

| 范围 | 已保存的证据 |
| --- | --- |
| 合约 | [41 项本地测试通过，含 256 组金额分配 fuzz](tests/reports/2026-09-30-ci-gate-demo-short.md) |
| Web / API | [79 项本地测试通过](tests/reports/2026-10-03-browser-e2e.md) |
| 集成 | [9 项通过，无跳过](tests/reports/2026-10-03-worker-runtime.md) |
| 浏览器 | [8 项通过，无跳过](tests/reports/2026-10-03-browser-e2e.md)：资金拆分、处理、超时、取消、拒签、重复领取及本地停运恢复 |
| Monad 测试网 | [部署、创建及 1,000 MockUSD 入金只读证据](deployments/README.md)；尚无完整结算和领取证据 |

浏览器测试使用外部钱包及扫描器替身，在本地 EVM 执行真实签名和交易；不能据此宣称真实 passkey、跨设备恢复或公网扫描服务已经验收。部署环境的 PostgreSQL/Worker 联调、真实设备同地址恢复、第二人完整复现与独立资金审查仍待完成。详见[验收清单](docs/acceptance.md)和[剩余问题](docs/blocker-log.md)。

## 本地运行与复现

使用 Node.js 24.x（仓库声明 24.14.0）及 pnpm 12.8.1，按锁文件安装依赖。在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
npm run backend:abi --prefix apps/web
npm run backend:init
npm run db:migrate
npm run fixtures:seed
npm run dev --prefix apps/web
```

打开 `http://localhost:3000`。初始化生成被 Git 忽略的 `apps/web/.env.local`；seed 只创建虚构草稿和邀请，不伪造入金。完成交互还需要配置可用 RPC、已核验合约和 R/F 已接受的服务方案，详见 [Web 配置](apps/web/README.md)与[后端运行说明](apps/web/src/server/README.md)。以上不是自动部署合约的一键完整 Demo。

如需直接复现隔离的本地浏览器资金流程，在安装依赖和生成 ABI 后执行：

```sh
pnpm --filter @rentbond/web exec playwright install --with-deps chromium
node tests/runner.mjs integration
node tests/runner.mjs e2e
```

测试会自行启动本地链、临时数据服务及测试钱包，不需要真实私钥或测试网资金。环境边界与产物位置见[测试说明](tests/README.md)。

其他检查：

```sh
node scripts/check-scaffold.mjs
npm run test:contracts
npm run test --prefix apps/web
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
```

独立 Worker 启动与 PostgreSQL 要求见 [Worker README](apps/worker/README.md)。根脚本 `infra:up`、`chain:local`、`contracts:deploy:local`、`dev`、`build` 仍为未实现占位，请使用上述模块命令。第二人全新 clone 的完整复现尚未验收。

## 外部代码、AI 与开发历史

外部组件用于基础设施和开发工具，不作为本团队原创代码申报：

| 外部代码／库 | 使用范围 |
| --- | --- |
| OpenZeppelin Contracts 5.0.2 | 仓库内保留的 ReentrancyGuard 防重入代码，位于 `contracts/lib/openzeppelin-contracts/` |
| Next.js、React、React DOM、TypeScript | 网页、服务端 API 与类型检查 |
| @category-labs/mera、viem | passkey 账户接入、签名适配及 EVM 交互 |
| PGlite、node-postgres、PostgreSQL | 本地及独立服务数据库 |
| Zod、fflate | 请求校验与 ZIP 导出 |
| ClamAV | 独立文件扫描服务 |
| Foundry、solc-js、Hardhat、Playwright | 合约编译、测试、本地链与浏览器自动化 |
| jsPDF | Worker 包声明的依赖；不将其视为已完成 PDF 导出能力的证据 |

完整直接依赖及版本范围见 [Web 清单](apps/web/package.json)、[Worker 清单](apps/worker/package.json)、[Shared 清单](packages/shared/package.json)；锁定版本和传递依赖见 [pnpm 锁文件](pnpm-lock.yaml)。已记录的来源与许可见[依赖矩阵](docs/dependency-matrix.md)。正式发布前仍需核对第三方许可、保留必要声明，并补齐直接收录代码的许可文件。

**AI 使用披露：** 本项目使用 AI 辅助工作；已确认使用 OpenAI Codex 辅助仓库审阅、README 和提交文档编辑。其他成员使用的 AI 工具及代码生成范围仍需在提交前汇总补充。AI 不参与产品中的争议裁决，测试通过与部署状态以实际记录为准。

**开发历史：** 本仓库最早提交为 `aaab8a4`（2026-09-18），后续历史记录合约状态机、网页/API、私有材料、Worker 和本地端到端测试的开发。保留完整 Git 历史，使用 `git log --reverse --date=iso-strict` 查看。提交日期本身不能证明全部内容原创；已有代码／资源、构建窗口前组件及比赛期间新增功能的归属仍需团队核对。外部基础组件按上表披露，不将其计入原创实现。

## 提交要求与许可证

按团队于 2026-10-04 提供的官方条款摘录，最终截止为 **2026-10-13 23:59 美国东部时间（EDT，UTC−4）**，即 **北京时间 2026-10-14 11:59**。必须通过黑客松网站提交，以平台记录的提交时间及截止时保存的版本为准。

当前仍需完成：公共 GitHub 访问核查、外部代码许可与完整 AI 披露、第三方按 README 独立运行、公开三分钟内视频，以及最终版本与链上证据的对应。原型支持范围和内部完整验收状态分别见[比赛清单](docs/contest/contest-requirements.md)与[验收清单](docs/acceptance.md)。

本项目原创代码采用 [MIT License](LICENSE)，版权声明为 `Copyright (c) 2026 RentBond contributors`。第三方代码、库和资源保留各自的许可与版权声明，不因本项目采用 MIT 而重新授权；第三方许可核查仍需完成。

## 项目资料

- [产品范围](docs/MVP-SPEC.md)与[架构](docs/architecture.md)
- [合约源码与构建](contracts/README.md)、[API 与接口](docs/interfaces/README.md)
- [部署手册](docs/runbooks/deployment.md)与[停运恢复](docs/runbooks/recovery.md)
- [验收清单](docs/acceptance.md)、[需求追踪](docs/requirements-traceability.md)与[比赛要求核查](docs/contest/contest-requirements.md)
- [团队分工](docs/team.md)与[贡献规范](CONTRIBUTING.md)

团队人数与资格、完整构建窗口定义及平台具体提交字段仍需补充核实；本页已确定要求依据团队提供的条款摘录，未声称已登录提交平台或完成投稿。
>>>>>>> a6716a7e67120714bd6b241b5f5c5d8f9ad0f1b8
