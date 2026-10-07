# RentBond — Programmable Rental Deposit Settlement

> **Dispute 200, not your entire 1,000 deposit.**

RentBond 在区块链上运行租房押金结算：房东逐项提出扣款，租客逐项认可或争议。申索窗口关闭后，无争议资金立即可领，争议部分按双方预先接受的程序处理。

**Monad 测试网 · MockUSD 测试资产，无现金价值。**

**赛道：Consumer Products & Payments。** 主要消费者是普通跨境租客，小型房东参与结算；核心价值是看懂扣款、回应争议及领取无争议押金。双方须在入金前同意使用，不能追回此前交给房东的押金，当前目标用户采用仍待验证。

**赞助商候选：Best Mera-Powered UX on Monad / Monad Foundation。** 正式页面已使用 Mera 创建／恢复 passkey 账户、完成 SIWE 登录并签署用户确认的交易；恢复不再依赖浏览器缓存或手填钱包地址。真实设备的提示次数、跨设备同址恢复与完整 Monad 测试网结算仍待验收，不能以本地自动化代替奖项证据。见[契合—问题—建议—证据](docs/contest/track-fit.md)。

---

## 演示场景

租客 Alice 存入 **1,000 MockUSD**，退租时房东申索清洁费 100、损坏费 200。Alice 认可清洁费，争议损坏费。

| 申索窗口关闭并确认分配后 | 金额 | 状态 |
| --- | ---: | --- |
| 未申索部分 → 租客 | 700 | 可领取 |
| 已认可扣款 → 房东 | 100 | 可领取 |
| 有争议扣款 | 200 | 待处理 |

若处理人裁决 50 给房东、150 给租客，挑战期结束且结果生效后最终分配为租客 850、房东 150；各自领取交易确认后才算已领取。窗口结束前的预计拆分不代表可领取。

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
| Passkey 派生的 EVM 签名账户 | @category-labs/mera | 0.2.0 |
| 端到端测试 | Playwright | 1.62.1 |
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
npm run backend:abi --prefix apps/web
npm run backend:init --prefix apps/web
npm run db:migrate --prefix apps/web
npm run backend:seed --prefix apps/web
npm run dev --prefix apps/web
```

访问 `http://localhost:3000`。

这会启动网页与后端；实际交易还需配置本地链或已核验的测试网 RPC、Factory 和服务方案。环境变量见 [Web 运行说明](apps/web/README.md)，数据库、扫描和 Worker 见 [后端说明](apps/web/src/server/README.md)。可自动启动临时本地链与网页的完整演练见 [tests/README.md](tests/README.md)；历史测试网地址并非已验收的 DEMO_SHORT 环境。

### 完整测试

```sh
pnpm --filter @rentbond/web exec playwright install --with-deps chromium
node tests/runner.mjs integration
node tests/runner.mjs e2e
npm run test:contracts
```

### Windows 开发注意事项

pnpm 首次安装需要显式允许构建脚本（esbuild 和 core-js 的 postinstall）：

```sh
pnpm install --allow-build=esbuild --allow-build=core-js
```

确认 Node 版本为 24.x：`node --version`。

---

## Monad 集成

RentBond 运行于 **Monad 测试网（chainId: 10143）**，使用 EVM 兼容执行环境。

### 已部署合约

| 合约 | 地址 |
| --- | --- |
| MockUSD（测试资产） | `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` |
| ResolverRegistry | `0x61f13f0c0DAaC2802EeD3Cd4DD9FD67c93d0ce30` |
| DepositEscrowDeployer | `0x7E717703E2bf6cF0b7562DA8cdEb718e65A4f13f` |
| LeaseFactory | `0x6ed49Bf8EE5E9ba2cbE2977fe100342Fe2999a7E` |
| 示例 DepositEscrow | `0x80753a6Dd914177fE8AD8cE28B325Fe1B677C479` |

### 链上证据

- 创建租约：`0x70f948a33e3af390cf53458b192ab6276ae5cac4a60414121bee8c40fcb8cafe`
- 入金 1,000 MockUSD：`0xf7e1cfef92efa9ba94fcffc94a7d66e5dde6c53ba19eedadce2ff1e1590286fa`
- [链上快照与核验记录](deployments/monad-testnet-2026-09-26.chain-evidence.json)

以上为 2026-09-26 历史部署和入金记录；快照 `readyForFrontend: false`，不能据此宣称已完成公网 850/150、900/100 分配及领取。Mera 是客户端签名账户实现；本项目没有因此实现 ERC-4337、Paymaster 或法币支付，测试手续费采用受限 MON 补给。

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
| OpenAI Codex | README 与提交文档编辑；D 后端、权限、扫描、测试与修复；本次账户恢复、会话及赛道证据完善 | A/D |

AI 不参与产品内的争议裁决。各成员仍需确认自身工具使用范围、既有组件和实际人工复核记录；自动化通过不代表已经完成全量人工审核或独立资金审查。

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
