# RentBond — Programmable Deposit Settlement

**面向跨境租房的国际学生，尤其解决退租后远程处理押金扣款和争议的问题。** 房东逐项提出扣款，租客逐项确认；申索窗口关闭后，无争议部分先分配，争议部分继续锁定并进入处理流程。

> **Dispute 200, not your entire 1,000 deposit.**
>
> RentBond helps international students and small landlords settle rental deposits remotely. Once the claim window closes, undisputed funds become claimable while disputed deductions follow the agreed resolution process.

**当前状态：成员 C 的可运行前端与显式虚构演示已实现；真实合约、后端与完整账户恢复验收尚待联调。** 页面、Mera 账户适配、金额工具及前端测试已加入。请先看 [成员 C 交付与接入指南](docs/member-c-delivery.md)，不要把演示结果当成链上验收。

## 产品面向谁

| 用户 | 第一版定位 |
| --- | --- |
| Primary user | 跨境租房、即将退租或已离境，需要远程结算押金的国际学生租客 |
| 初始画像假设 | 18–28 岁、初次或前几次海外租房；年龄是研究画像，不是代码准入限制 |
| Adoption-side user | 经常出租给国际学生的私人房东及小型物业管理方 |
| 暂不优先 | 已有成熟系统的大型机构学生公寓；不泛化为“所有留学生” |

用户需要在**入金前双方接受规则并将押金存入合约**。RentBond 无法追回已交给房东的旧押金；“已离境”描述结算时的场景，不代表可以事后单方迁入旧押金。当前定位是首批用户假设，尚无真实采用数据。

## 核心 Demo：1,000 → 700 / 100 / 200

Alice 是国际学生，退租后已回国。她与房东在入住前确认了押金规则并存入 **1,000 MockUSD**。房东申索清洁 100、桌面损坏 200；Alice 认可清洁费，对原有划痕提出异议。

| 申索窗口关闭后的资金 | 数额 | 状态 |
| --- | ---: | --- |
| 未申索部分 → 租客 | 700 MockUSD | 可领取 |
| 已认可扣款 → 房东 | 100 MockUSD | 可领取 |
| 争议部分 | 200 MockUSD | 待处理，尚未分配 |

若有效处理结果支持其中 50 给房东，最终租客 850、房东 150；若主备处理均超时，按事先接受的退出政策最终租客 900、房东 100。领取交易确认后才显示“已领取”。上述为**虚构案例**，本次前端模拟测试覆盖此流程；真实链上验收尚未运行。

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

## 启动成员 C 前端

需要 Node.js 24.14+（小于 25）及 pnpm 11.19.0，依赖精确版本已锁定。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://127.0.0.1:3000，点击“体验部分结算”进入明确标注的纯内存演示。使用上方场景和角色选择器检查入金、逐项回应、主备处理、超时退出、和解与领取。刷新会清空演示数据；不需要钱包、数据库或 RPC。

默认真实模式在 API 缺失时显示未接入，不自动加载虚构租约。账户页包含真实 Mera 调用，但同地址跨设备恢复、SIWE、费用补给仍需真机及 D 的服务验证。前端配置路径为 `apps/web/.env.local`，模板见 [web 环境模板](apps/web/.env.example)。

```sh
pnpm doctor
pnpm check                 # 文档骨架、TypeScript、19 个逻辑用例
pnpm build                 # Next.js 生产构建
pnpm --filter @rentbond/web exec playwright install chromium
pnpm test:web:e2e          # 8 个桌面/移动端浏览器用例
```

`test:web:e2e` 是前端模拟验收；完整链上 `test:e2e` 仍为明确失败的占位。`infra:up`、`db:migrate`、`chain:local`、合约部署/测试、`fixtures:seed`、`worker:dev` 和 `test:integration` 也待各负责人实现。真实部署与私有存储未完成。

## GitHub 协作

仓库为 [Jenny-qi/RentBond](https://github.com/Jenny-qi/RentBond)。从主分支创建功能分支，提交 PR，请相应模块负责人审阅后合并，详见 [CONTRIBUTING](CONTRIBUTING.md)。本次 C 交付分支为 `feat/RB-08-member-c-frontend`，涉及共享金额与基础构建的交接见交付指南。

不要把 `node_modules`、`.next`、`.pnpm-store`、`.env.local` 或真实材料上传 GitHub。锁文件必须提交，团队使用 frozen install 复现。A 按 [GitHub 设置清单](docs/github-setup.md) 配置分支保护及真实 CODEOWNERS；仓库模板不会自动设置远端规则。

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

前端独立阶段已交付；真实合约、钱包真机兼容、私有权限、停运恢复和链上交易证据未完成。完整 AT 运行结果仍为 `Not run`，前端测试单独记录。原 PRD 中的比赛日期和供应商能力是历史来源，正式资格、团队人数和截止时区待核对。项目未选择对外开源许可证；发布前由团队决定并记录第三方许可。
