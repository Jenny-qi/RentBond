# RentBond — Programmable Deposit Settlement

**面向在海外租房并需要远程处理押金结算的人群，包括国际学生、海外工作者和陪读／随迁家庭。** 房东逐项提出扣款，租客逐项确认；申索窗口关闭后，无争议部分先分配，争议部分继续锁定并进入处理流程。

> **Dispute 200, not your entire 1,000 deposit.**
>
> RentBond helps cross-border renters and small landlords settle rental deposits remotely. Once the claim window closes, undisputed funds become claimable while disputed deductions follow the agreed resolution process.

**当前状态：合约模块已有本地实现和 40 个通过的 Foundry 测试；固定构建 ABI 已导出，Monad 测试网仍未广播部署。** 网页、后端、账户体验及跨层验收仍未完成；文档和本地检查不能替代独立审查或真实链上证据。

## 产品面向谁

| 用户 | 第一版定位 |
| --- | --- |
| Primary user | 跨境租房、即将退租或已离境，需要远程结算押金的海外租客 |
| 首批场景 | 国际学生、海外工作者、陪读／随迁家庭；这些是获客场景，不是代码准入限制 |
| Adoption-side user | 经常服务跨境租客的私人房东及小型物业管理方 |
| 暂不优先 | 已有成熟押金系统的大型机构公寓；不泛化为所有租房交易 |

用户需要在**入金前双方接受规则并将押金存入合约**。RentBond 无法追回已交给房东的旧押金；“已离境”描述结算时的场景，不代表可以事后单方迁入旧押金。当前定位是首批用户假设，尚无真实采用数据。

## 核心 Demo：1,000 → 700 / 100 / 200

Alice 是跨境租客，退租后已离开当地。她与房东在入住前确认了押金规则并存入 **1,000 MockUSD**。房东申索清洁 100、桌面损坏 200；Alice 认可清洁费，对原有划痕提出异议。

| 申索窗口关闭后的资金 | 数额 | 状态 |
| --- | ---: | --- |
| 未申索部分 → 租客 | 700 MockUSD | 可领取 |
| 已认可扣款 → 房东 | 100 MockUSD | 可领取 |
| 争议部分 | 200 MockUSD | 待处理，尚未分配 |

若有效处理结果支持其中 50 给房东，最终租客 850、房东 150；若主备处理均超时，按事先接受的退出政策最终租客 900、房东 100。领取交易确认后才显示“已领取”。上述仍是**虚构案例，不是真实用户数据**；对应本地合约流程测试已通过，但尚无 Monad 测试网交易。

主 Demo 展示 Tenant / Landlord / Resolver 三种角色。备用处理、服务预授权、超时退出、Worker 和故障恢复保留在完整实现及技术附录中。详见 [MVP 规格](docs/MVP-SPEC.md) 与 [Demo 脚本](docs/contest/demo.md)。

## 工程范围

- Monad 测试网，MockUSD 为 6 位小数测试资产，无现金价值；不接真实押金、不收平台费、不生息。
- 单租客、单房东、单笔押金；每份租约一个不可升级的合约；最多 10 项申索。
- R/F 预授权服务方案，T/L 逐约确认；资金受益人仅限固定 T/L。
- 默认 Mera passkey 与受限测试 MON 补给属于 P0；若兼容性试验失败按 PRD 8.5 评估替代，不静默换账户。
- 到期进入结算，不立即退全款。正常配置最迟 `hardEndAt = leaseEndAt + 37 天`；有效扣款先落实，剩余按固定政策退出。
- 不做 AI 裁决、房源市场、NFT、信誉代币、收益或 DAO。邮件与完整双语为 P1。

## 五人如何分工

| 成员 | 主责 | 主要目录 | 首项交付 |
| --- | --- | --- | --- |
| A 产品与协作 | 需求、交互验收、比赛规则、看板、Demo | `docs/`、`fixtures/` | 冻结 MVP 与提交规则 |
| B 智能合约 | 注册表、Factory、资金状态机、合约测试与部署 | `contracts/`、`deployments/` | 最小资金闭环与越权测试 |
| C 前端与账户 | 页面、passkey、恢复、链上交互与确认体验 | `apps/web/src/app/` 页面、`components/`、`features/` | 账户试验与 700/100/200 资金拆分界面 |
| D 后端与数据 | SIWE、API、ACL、私有存储、导出、测试补给 | `apps/web/src/app/api/`、`server/`、`infra/` | 登录与跨租约访问拒绝试验 |
| E 集成与质量 | Worker、CI、端到端、故障恢复、发布复现 | `apps/worker/`、`tests/`、`scripts/`、`.github/` | 独立 clone 检查与测试基线 |

五位成员不是五个链上角色。开发用 A–E，运行角色用 T/L/R/F/O/K；详见 [团队分工与交接](docs/team.md)。

## 目录结构

```text
RentBond/
├── apps/
│   ├── web/src/               # Next.js 页面与服务端 API
│   └── worker/src/            # 独立 Node.js 事件同步与到期任务
├── packages/shared/src/       # 类型、金额、schema、承诺值、网络适配
├── contracts/                 # Solidity 源码、Foundry 测试及部署
├── infra/                     # 数据库迁移、私有 Storage 策略
├── deployments/               # 真实部署记录；当前只有模板
├── fixtures/                  # 明确标记的虚构租约案例
├── tests/                     # integration 与 e2e
├── scripts/                   # 骨架检查及后续开发工具
├── docs/                      # PRD、MVP、分工、接口、ADR、验收、运维
├── .github/                   # Issue/PR 模板、骨架 CI、CODEOWNERS 示例
├── .env.example               # 无密钥配置模板
├── AGENTS.md                  # 开发 Agent 的仓库约定
└── CONTRIBUTING.md            # 分支、审查、合并及交付规范
```

每个模块有自己的 README，列明负责人、允许改动范围和输入输出；Git 会保留这些目录。

## 新成员从哪里开始

1. 阅读 [MVP-SPEC](docs/MVP-SPEC.md)，再读 [PRD](docs/PRD.md) 第 6、7、11 章。
2. 在 [team](docs/team.md) 填写姓名和 GitHub 账号，在 [backlog](docs/backlog.md) 领取 Issue。
3. 阅读 [架构](docs/architecture.md) 和 [接口约定](docs/interfaces/README.md)，先确认交接再并行实现。
4. 按 [CONTRIBUTING](CONTRIBUTING.md) 建分支；PR 写需求编号、实际测试结果和交接影响。

## 当前能运行的检查

骨架检查依赖 Node.js **24.14.0**。合约命令通过 npx 使用固定的 `@foundry-rs/forge@1.7.1`；网页依赖和锁文件仍待 RB-02 固定。

```sh
node scripts/doctor.mjs
node scripts/check-scaffold.mjs
node scripts/ts04-clone-verify.mjs   # TS04：独立 clone 验证
npm run build:contracts
npm run test:contracts
npm run check:contract-sizes
npm run contracts:export:abi
```

已有 pnpm 时可运行 `pnpm doctor` 与 `pnpm check`。`doctor` 只检查骨架运行环境；`check` 检查本地文档链接、JSON、需求覆盖及目录；`ts04` 目前仍是骨架级 clone 检查。合约测试已经实现；网页 lint、类型检查和跨层业务测试尚未实现。

**跨层测试命令（RB-12/RB-13 后可运行）：**

```sh
node tests/runner.mjs integration  # IT-01 — IT-08
node tests/runner.mjs e2e         # E2E-01 — E2E-08
node tests/runner.mjs all          # 全部
pnpm test:integration              # 同上 via pnpm
pnpm test:e2e                     # 同上 via pnpm
```

根目录预留 pnpm workspace。RB-02 要固定 packageManager、依赖精确版本与真实生成的 `pnpm-lock.yaml`，不能把“安装最新版”作为长期说明。详见 [依赖矩阵](docs/dependency-matrix.md)。

### 后续完整启动目标

除 `test:contracts` 外，下列应用/基础设施命令仍未实现；占位命令会明确报错并指出责任 Issue。实现后须由另一位成员从新 clone 验证，再更新本节。

```sh
pnpm install --frozen-lockfile   # RB-02 提交锁文件后使用
pnpm doctor
pnpm infra:up
pnpm db:migrate
pnpm chain:local                 # 独立终端 1，常驻
pnpm contracts:deploy:local      # 新终端，等待本地链就绪
pnpm fixtures:seed
pnpm dev                         # 独立终端 2，常驻
pnpm worker:dev                  # 独立终端 3，常驻
pnpm check
npm run test:contracts            # 已实现
pnpm test:integration
pnpm test:e2e
pnpm build
```

从 `.env.example` 配置服务环境，实际加载路径由 RB-02 固定。密钥、私有文件和真实合同不进入 Git。`npm run contracts:preflight:testnet` 只读核对网络；`npm run contracts:deploy:testnet` 仅允许显式选择 Monad Testnet、RPC 返回 chainId 10143、使用本地 Forge keystore 且二次确认后广播，不会缺配置时回退其他网络。

## GitHub 协作

仓库已经存在。每位成员从最新 `main` 创建自己的功能分支，通过 PR 合并，不要在 GitHub 网页和本地同时改同一文件：

```sh
git switch main
git pull --ff-only
git switch -c <type/member-topic>
# 修改并运行对应测试
git add <本任务文件>
git diff --cached
git commit -m "<type>: <summary>"
git push -u origin HEAD
```

提交前检查差异中没有密钥和私人资料。A 邀请成员，按 [GitHub 设置清单](docs/github-setup.md) 配置分支保护、任务看板和真实 CODEOWNERS。仓库内的模板不会自动设置远端规则。

## 文档导航

| 内容 | 入口 |
| --- | --- |
| 需求与修改对照 | [PRD](docs/PRD.md)、[MVP](docs/MVP-SPEC.md)、[changes](docs/changes.md)、[来源](docs/sources/README.md) |
| 分工与计划 | [team](docs/team.md)、[backlog](docs/backlog.md)、[implementation-plan](docs/implementation-plan.md) |
| 架构与接口 | [architecture](docs/architecture.md)、[interfaces](docs/interfaces/README.md) |
| 验收与追踪 | [requirements-traceability](docs/requirements-traceability.md)、[acceptance](docs/acceptance.md) |
| 依赖与阻塞 | [dependency-matrix](docs/dependency-matrix.md)、[blocker-log](docs/blocker-log.md) |
| 发布与恢复 | [deployment](docs/runbooks/deployment.md)、[recovery](docs/runbooks/recovery.md) |
| 比赛与展示 | [contest-requirements](docs/contest/contest-requirements.md)、[demo](docs/contest/demo.md) |

## 已知限制

合约已有本地实现，但仍缺完整边界/fuzz/invariant、独立安全复核与 Monad 部署证据；网页、钱包兼容、私有权限、Worker 和停运恢复尚未完成。AT 状态在固定 commit 与独立复核前不能写成 Verified。原 PRD 中的比赛日期和供应商能力是历史来源，正式资格、团队人数和截止时区仍待核对。项目未选择对外开源许可证；发布前由团队决定并记录第三方许可。
