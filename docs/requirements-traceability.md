# 需求追踪表

## 2026-10-08 演示就绪检查

RB-12/13/14、TS02/04/05、AT12/16/23/26/34/41/42/46/51：新增[当前工作区复查记录](../tests/reports/2026-10-08-demo-readiness.md)，区分依赖安装失败、缺失报告、历史本地证据与尚未验收的公网/真机/独立复核。未改业务规则和实现，不提升任何 FR/SC/AT/TS 状态。

## 2026-10-08 页面品牌同步

MVP P01–P12 / C 页面展示：`BrandLogo`、全局 metadata 和 `public/brand/` 使用用户最新素材，所有页面共用新暖灰白／灰金 Logo，图标资源带缓存版本。5 个原包哈希、12 个未登录路由的 HTTP 引用、类型与浏览器布局检查见[记录](../tests/reports/2026-10-08-brand-refresh.md)。本轮仅变更展示资产，不改变 FR/SC/AT 业务规则或验证状态。

## 2026-10-07 账户体验与参赛证据

RB-08 / RB-14、PRD 8.5、TS05、AT27/28/33/41/42：正式 `live/wallet.ts` 恢复取消缓存地址依赖，`LiveProvider` 增加可见会话期限及绝对时间检查；`mera-recovery.test.mjs` 验证同址重新 SIWE、原租约/材料/导出权限、旧链接失效及不同凭证拒绝越权。API/schema/ABI 和金额规则均未改变，C/E 可按原接口继续接入。实际重跑 Web 83、Integration 9、浏览器 E2E 8 项全部通过、零跳过，详见 [本轮报告](../tests/reports/2026-10-07-consumer-mera.md)。

CH02/04/08：README 与 [赛道对照](contest/track-fit.md)补充消费者定位、Mera 真实路径及奖项证据边界，修正交易哈希归属、依赖版本、启动命令和 D 的 Codex 披露。本轮不把文档或替身回归提升为任何 FR/SC/AT 的真机、公网或全量 Verified。

2026-10-04 RB-14 许可材料：用户选择 MIT，已添加根 LICENSE 并更新 README 和提交清单。第三方组件沿用自身许可；本次不改变 FR/SC/AT 验证状态。

2026-10-04 提交映射：README 增加 Monad 地址／入金交易、外部组件、AI 披露、开发历史与官方截止；演示脚本调整为 165 秒。对应 CH02/04/08 与 RB-14 的提交说明，不改变 FR/SC 规则或验证状态。

## 2026-10-04 提交文档整理

README 改为评委入口；删除旧交接、排期和建仓清单，后端运行内容归并至 apps/web/src/server/README.md。仅整理文档及引用，FR/SC 实现和验证状态不变。

## 历史基线：PR #17 合并后的 main（2026-10-03）

源码基线 `ffe56a8c8cb7654ae0864a7d3c8e2a426b815be0`，已包含 PR #14/#15 的 Worker 与 PR #17 的浏览器测试。PR #17 的 7 项自动检查通过；本地 Integration 为 9 passed / 0 skipped、Chromium E2E 为 8 passed / 0 skipped、Web 为 79 passed。证据见 [Worker 报告](../tests/reports/2026-10-03-worker-runtime.md)、[后续复查](../tests/reports/2026-10-03-worker-followup.md)及[浏览器报告](../tests/reports/2026-10-03-browser-e2e.md)。本节为当日历史快照，最新增量见本页顶部。

真实 Monad DEMO_SHORT 的 700/100/200 → 850/150 和 900/100 分配/领取、Mera/WebAuthn PRF 两类真机同址恢复、所选公网 PostgreSQL/Worker/TLS/私有文件 ACL 验收、第二人新 clone 复现与独立资金审查仍待完成。CI 通过不将这些需求提升为 Verified。

2026-10-02 main 复核：D 第一、第二阶段均已合入；修复 Windows 扫描配置换行、ClamAV 日期时区和原主链回归时未签名任务无法重排的问题。实现基线 cbe41fc，Web 69 项、真实环境集成及 HTTP 通过。见 [D main 检查记录](../tests/reports/2026-10-02-member-d-main-review.md)。D 可独立交付项已验证，联合/公网/真机需求仍按以下状态，不提升为整项目 Verified。

2026-10-02 D：FR-10/11/12/24/28/33/34、PRD 9.4、SC-04/12 与 AT27/28/29/33/43/44 的本轮增量为扫描隔离、C 等待扫描、旧版本/旧 ZIP 升级阻断，以及 E 可调用的 PostgreSQL 持久化任务/回滚边界。真实 ClamAV、PostgreSQL 并发/匿名 RLS、HTTP 与本地 EVM 的证据见 [D 第二阶段报告](../tests/reports/2026-10-02-member-d-stage-two.md)。本轮不将 API/数据库切片提升为全链路 Verified。总验收仍有 12 项跳过；现无论全部或部分跳过均返回非零。
2026-10-02：修复验收运行器对部分 skipped 返回 0、CI 将全部 skipped 的退出码 2 转成成功的问题。E2E 八项仍未实现；该门槛修复不改变任何 FR/SC 的业务验证状态。

2026-09-30：`CreateDemoShortProfile.s.sol` 与 `deployments/demo-short.example.json` 是尚未部署的短时配置模板；新增 256 组本地 fuzz 检查申索金额、分配和领取守恒，未改变 FR/SC 通过范围。Worker 调度只保存事件区块和 UTC 到期秒数，真实轮询/持久化/链上写入仍在 RB-12；E2E 全跳过现使验收命令失败。相关状态保持 In progress。

2026-09-29 C 实施：实际页面入口为 `apps/web/src/features/live/`，消费固定 ABI、D API 和真实回执；实现位置与验证边界见 [Web README](../apps/web/README.md)。FR-01/03/05—08/10—34 的页面接线与英文展示不改变 SC 金额/权限/截止规则；公网完整流程与设备恢复尚未验收，状态继续 In progress。原模拟模型仅用于历史回归测试。

2026-09-29 阶段复查：见本表与 blocker-log 的阶段记录。FR-19/20/31 对应真实页面分配领取仍未闭环；SC-12 对应 Worker 截止判断存在时间戳/区块高度混用；FR-33 的后端导出已有而页面接入待完成。关联 RB-09—13、AT12/23/26/29—31/33/47/51；本次为检查记录，不构成业务 Verified。

2026-09-24 补充只读 Monad Testnet 证据检查脚本及用户观察记录（`scripts/verify-monad-evidence.mjs`、`deployments/monad-testnet-2026-09-24.observed.json`）。该工具仅验证链 ID、字节码存在和交易收据基本字段；当前环境 RPC 连接超时，尚不能作为 FR-03、SC-09 或 AT02 的链上通过证据，状态不变。

2026-09-26 后续独立只读 RPC 已核对部署区块/回执、可执行字节码、ABI 摘要、事件、条款和入金余额，见 [证据报告](../tests/reports/2026-09-26-monad-chain-evidence.md)。这支持 FR-03、FR-07、SC-09、AT02 的**一次入金实例**，仍缺第二次入金拒绝、四账户/异常路径及完整结算，需求状态保持 In progress。

FR/SC 来自 v1.2。合约切片已填写实现文件和本地测试证据；跨层部分继续保留 In progress/Not started。Verified 仍需要固定 commit、独立复核、适用环境与完整验收，不能把本地单元测试当成发布完成。

2026-09-27 D 后续复核涵盖 FR-10/11/12/17/18/21/24/28/33/34、SC-04 与 AT27/33/43/44；修复、回归命令、真实结果和未完成发布要求见 [D 逐项复核](../tests/reports/2026-09-27-member-d-review.md)。下表 D:96dcffc 为初始实现基线，不能忽略这份后续修复记录。

| requirementId | 原文位置与摘要 | owner | plannedLocation | implementationFiles | testIds | status | commit | evidenceLink |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-01 | PRD 6/7章：界面始终显示“Monad 测试网 · 测试资产，无现金价值” | C | apps/web/src/features/ | `apps/web/src/features/live/` (live API/ABI; public E2E pending) | AT41 | In progress | working tree; base 0dcc55f | [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-02 | PRD 6/7章：本版押金 D 范围为 1—10,000 MockUSD，前端输入最多 2 位小数，合约接受以 0.01 MockUSD 为最小业务单位的金额 | B/C | contracts/src/; packages/shared/src/ | `RentBondRules.sol`; `DepositEscrow.sol`; `ResolverRegistry.sol`; `apps/web/src/lib/money.ts` (frontend fixture only); `apps/web/src/features/live/` | AT02/10/36 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-03 | PRD 6/7章：只允许指定租客从其地址一次存入精确的 D | B | contracts/src/ | `DepositEscrow.sol` | AT01/02/38/40 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-04 | PRD 6/7章：合约只接受部署时固定的 MockUSD 地址，不支持收取转账税或余额自动变化的代币 | B | contracts/src/ | `MockUSD.sol`; `DepositEscrow.sol` | AT02/24/25 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-05 | PRD 6/7章：分配形成“可领取余额”；领取交易确认后才是“已领取” | B/C | contracts/src/; apps/web/src/features/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/components/AmountSplit.tsx` (frontend fixture only); `apps/web/src/features/live/` | AT03/12/23 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-06 | PRD 6/7章：房东创建可编辑草稿，填写租赁关系和约定，选择有效服务方案 | C/D | apps/web/src/app/; apps/web/src/server/ | `apps/web/src/server/leases.ts`; `apps/web/src/features/live/` | AT27/41/52 | In progress | D: 96dcffc; C: working tree (base 0dcc55f) | [D local slice](../tests/reports/2026-09-26-member-d.md); [Web implementation](../apps/web/README.md) |
| FR-07 | PRD 6/7章：房东检查条款后部署租约合约 | B/C | contracts/src/; apps/web/src/features/ | `LeaseFactory.sol`; `DepositEscrowDeployer.sol`（合约切片）; `apps/web/src/features/live/` | AT01/02/37/38/40 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [Web implementation](../apps/web/README.md) |
| FR-08 | PRD 6/7章：租客先查看完整金额、规则和收款合约，再确认存入 | B/C | contracts/src/; apps/web/src/features/ | `apps/web/src/features/leases/workflow.ts` (frontend fixture only); `apps/web/src/features/live/` | AT03/41/43 | In progress | pending; C: working tree (base 0dcc55f) | [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-09 | PRD 6/7章：入金前任一当事人可取消该约定；取消后不能再接受或入金 | B | contracts/src/ | `DepositEscrow.sol` | AT01/02/26 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-10 | PRD 6/7章：入住清单至少包含房间／物品名称、状况描述、文件、提交者、提交时间和对方状态 | C/D | apps/web/src/features/; apps/web/src/server/ | `apps/web/src/server/documents.ts`; `apps/web/src/features/live/` | AT27/33/35 | In progress | D: 96dcffc; C: working tree (base 0dcc55f) | [D local slice](../tests/reports/2026-09-26-member-d.md); [Web implementation](../apps/web/README.md) |
| FR-11 | PRD 6/7章：每次提交形成新版本，已提交的正文和文件不能被覆盖 | B/D | contracts/src/; apps/web/src/server/ | `DepositEscrow.sol`（承诺值切片）; `apps/web/src/server/documents.ts` (and related schema/ACL) | AT33/35 | In progress | D: 96dcffc | [local report](../tests/reports/2026-09-21-contracts-local.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| FR-12 | PRD 6/7章：维修记录、租期内事件和退租清单复用该结构 | C/D | apps/web/src/features/; apps/web/src/server/ | `apps/web/src/server/documents.ts`; `apps/web/src/features/live/` | AT33/35 | In progress | D: 96dcffc; C: working tree (base 0dcc55f) | [D local slice](../tests/reports/2026-09-26-member-d.md); [Web implementation](../apps/web/README.md) |
| FR-13 | PRD 6/7章：任一方可请求确认提前交接，提交实际日期和材料摘要；另一方认可或有效处理结果确认后，可提前开启申索 | B/C | contracts/src/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/features/live/` | AT05/06/45/50 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [Web implementation](../apps/web/README.md) |
| FR-14 | PRD 6/7章：提前交接请求存在异议或逾期未回应，可进入 CHECKOUT 案件 | B | contracts/src/ | `DepositEscrow.sol` | AT07/45/50 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-15 | PRD 6/7章：CHECKOUT 有效结果仅为提前交接成立或不成立 | B | contracts/src/ | `DepositEscrow.sol` | AT08/50 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-16 | PRD 6/7章：申索窗口内，房东可以准备最多 10 项扣款，一次性在链上提交最终清单；每项必须金额为正、带证据清单承诺值，累计金额不超过 D | B/C | contracts/src/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/features/leases/ClaimComposer.tsx` (frontend fixture only); `apps/web/src/features/live/` | AT10/11/26 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-17 | PRD 6/7章：扣款的私有正文包含类别、金额、理由、对应租约条款、入住和退租资料引用、票据／报价和解释 | C/D | apps/web/src/features/; apps/web/src/server/ | `apps/web/src/features/leases/ClaimComposer.tsx` (frontend fixture only); `apps/web/src/server/documents.ts`; `apps/web/src/features/live/` | AT11/27/33 | In progress | D: 96dcffc; C: working tree (base 0dcc55f) | [C local slice](../tests/reports/2026-09-25-member-c.md); [D local slice](../tests/reports/2026-09-26-member-d.md); [Web implementation](../apps/web/README.md) |
| FR-18 | PRD 6/7章：清单提交后可追加证据版本，不能修改原金额与理由版本 | B/D | contracts/src/; apps/web/src/server/ | `DepositEscrow.sol`（链上承诺切片）; `apps/web/src/server/documents.ts` | AT11/35 | In progress | D: 96dcffc | [local report](../tests/reports/2026-09-21-contracts-local.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| FR-19 | PRD 6/7章：申索窗口关闭后，不存在有效清单即 C=0；已有清单则 C 为固定申索总额 | B | contracts/src/ | `DepositEscrow.sol` | AT09/12/14/26 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-20 | PRD 6/7章：租客可在清单提交后至统一 responseDeadline 前，逐项“认可”或“提出异议”；认可需要单独确认金额及不可撤销性 | B/C | contracts/src/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/features/leases/workflow.ts` (frontend fixture only); `apps/web/src/features/live/` | AT12/13/26 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-21 | PRD 6/7章：有异议的项目可以附说明 | B | contracts/src/ | `DepositEscrow.sol` | AT13/26 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-22 | PRD 6/7章：房东在正式 CLAIMS 案件创建前可撤回尚未分配项目；窗口关闭前撤回的金额在 closeClaims 时归租客，窗口关闭后撤回则即时归租客 | B | contracts/src/ | `DepositEscrow.sol` | AT14/15 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-23 | PRD 6/7章：回应截止后，未分配的全部有效申索统一进入一宗 CLAIMS 案件，避免为 10 个项目启动 10 个独立处理流程 | B | contracts/src/ | `DepositEscrow.sol` | AT13/36 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-24 | PRD 6/7章：案件记录 caseId、类型、金额快照与固定期限 | B/D | contracts/src/; apps/web/src/server/ | `DepositEscrow.sol`（链上切片）; `apps/web/src/server/projections.ts` (and related schema/ACL) | AT27/44/47 | In progress | D: 96dcffc | [local report](../tests/reports/2026-09-21-contracts-local.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| FR-25 | PRD 6/7章：证据窗口结束后，R 可以提出一次结果 | B/C | contracts/src/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/app/resolver/page.tsx` (frontend fixture only); `apps/web/src/features/live/` | AT16/36 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-26 | PRD 6/7章：R 提出结果后，T、L 任一方可在 T_challenge 内请求备用处理，附理由承诺值 | B/C | contracts/src/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/features/leases/model.ts` (frontend fixture only); `apps/web/src/features/live/` | AT16/17/26 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-27 | PRD 6/7章：R 未在 primaryDeadline 前提出结果时，任何人可升级 F，备用起点固定为 primaryDeadline；有及时挑战时起点为 challengedAt | B | contracts/src/ | `DepositEscrow.sol` | AT18/47 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-28 | PRD 6/7章：F 在固定备用起点后的前 2 天接收补充材料，其后至 fallbackDeadline 前可提交一次最终结果，仍受金额与理由要求约束 | B/D | contracts/src/; apps/web/src/server/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/server/statements.ts` (and related schema/ACL) | AT19/20/44 | In progress | D: 96dcffc | [local report](../tests/reports/2026-09-21-contracts-local.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| FR-29 | PRD 6/7章：CLAIMS 的 F 未按期提交有效结果，进入 ExitPending；到 fallbackDeadline + T_exitNotice 后，任何人可调用 finalizeTimeout，将尚无有效支持的争议款计入租客可领取余额 | B/E | contracts/src/; apps/worker/src/ | `DepositEscrow.sol`（合约切片） | AT20/46/47/48/49 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-30 | PRD 6/7章：成功入金后、U>0 且尚未达到有效 timeoutAt/hardEndAt 时，双方可对当前未分配金额共同和解 | B/C | contracts/src/ | `DepositEscrow.sol`（合约切片）; `apps/web/src/features/leases/model.ts` (frontend fixture only); `apps/web/src/features/live/` | AT21/22/49 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-31 | PRD 6/7章：T/L 可调用 withdraw；任何人也可调用 withdrawFor(固定 T 或 L 地址)承担交易费用，收款人不能由调用者改变 | B/E | contracts/src/; scripts/ | `DepositEscrow.sol`（合约切片） | AT04/23/24/51 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| FR-32 | PRD 6/7章：U=0 时显示“分配完成”；U+CT+CL=0 时显示“全部领取完成” | B/C | contracts/src/; apps/web/src/features/ | `DepositEscrow.sol`（会计切片）; `apps/web/src/app/leases/[id]/settlement/page.tsx` (frontend fixture only); `apps/web/src/features/live/` | AT23/46/47 | In progress | pending; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md); [Web implementation](../apps/web/README.md) |
| FR-33 | PRD 6/7章：导出包包含条款版本、角色地址、各方确认记录、材料清单与可访问原件、申索回应、处理理由、资金流水和核验说明 | D/E | apps/web/src/server/; apps/worker/src/ | `apps/web/src/server/jobs.ts` | AT27/33 | In progress | D: 96dcffc | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| FR-34 | PRD 6/7章：正式提交的材料按清单打包，由提交者钱包调用 recordEvidence 记录 bundleId、版本和承诺值；对方调用 acknowledgeEvidence 表示认可或异议 | B/C/D | contracts/src/; apps/web/src/server/ | `DepositEscrow.sol`（链上承诺切片）; `apps/web/src/server/documents.ts` (and related schema/ACL); `apps/web/src/features/live/` | AT33/35 | In progress | D: 96dcffc; C: working tree (base 0dcc55f) | [local report](../tests/reports/2026-09-21-contracts-local.md); [D local slice](../tests/reports/2026-09-26-member-d.md); [Web implementation](../apps/web/README.md) |
| SC-01 | PRD 10/11章：服务端保存部署区块与同步检查点，按区块范围抓取事件；重启后从检查点回溯一段区间重放 | E | apps/worker/src/; packages/shared/src/ | `apps/worker/src/indexer/loop.ts`; `apps/worker/src/persistence/backend.mjs` | AT29 | In progress | main: ffe56a8; local evidence only | [Worker report](../tests/reports/2026-10-03-worker-runtime.md); [browser report](../tests/reports/2026-10-03-browser-e2e.md) |
| SC-02 | PRD 10/11章：确认策略由 network-adapter 实现 | E | apps/worker/src/; packages/shared/src/ | `apps/worker/src/rpc.mjs`; `apps/web/src/server/chain.ts` | AT29/30 | In progress | main: ffe56a8; local evidence only | [Worker report](../tests/reports/2026-10-03-worker-runtime.md); [browser report](../tests/reports/2026-10-03-browser-e2e.md) |
| SC-03 | PRD 10/11章：页面出现“已确认”需满足配置的确认策略；“钱包到账”还需成功领取事件与余额核验 | E | apps/worker/src/; packages/shared/src/ | `apps/web/src/server/chain.ts`; `apps/web/src/features/live/` | AT03/29/30 | In progress | main: ffe56a8; local evidence only | [Worker report](../tests/reports/2026-10-03-worker-runtime.md); [browser report](../tests/reports/2026-10-03-browser-e2e.md) |
| SC-04 | PRD 10/11章：主 RPC 失败时切换经过同网络验证的备用 RPC；两个端点 chainId 不一致时立即禁用写操作 | E | apps/worker/src/; packages/shared/src/ | `apps/worker/src/rpc.mjs`; `apps/web/src/server/chain.ts` | AT30 | In progress | main: ffe56a8; local evidence only | [Worker report](../tests/reports/2026-10-03-worker-runtime.md); [browser report](../tests/reports/2026-10-03-browser-e2e.md) |
| SC-05 | PRD 10/11章：Worker 采用持久任务与幂等公开函数；startScheduledSettlement、案件超时推进、finalizeTimeout、expireEscrow 与 withdrawFor 不依赖 Worker、数据库或运营者批准 | E | apps/worker/src/; packages/shared/src/ | `apps/worker/src/jobs/executor.ts`; `apps/worker/src/persistence/backend.mjs` | AT31/47/51 | In progress | main: ffe56a8; local evidence only | [Worker report](../tests/reports/2026-10-03-worker-runtime.md); [browser report](../tests/reports/2026-10-03-browser-e2e.md) |
| SC-06 | PRD 10/11章：任何人无法把合约资金分配给 T、L 以外地址；R、F、O 不存在资金受益路径 | B | contracts/src/ | `DepositEscrow.sol` | AT04/51 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-07 | PRD 10/11章：所有金额非负，累计分配不超过 D，每项分配不超过申索额；分配和领取分别记账 | B | contracts/src/ | `DepositEscrow.sol` | AT12/23/24/36/46 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-08 | PRD 10/11章：申索总额的上限由合约检查，不能只靠网页 | B | contracts/src/ | `DepositEscrow.sol` | AT10/36 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-09 | PRD 10/11章：只有经过资金交易成功确认的租约可进入 Active；任何失败的转账不得留下已入金标记 | B | contracts/src/ | `DepositEscrow.sol` | AT02/03 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-10 | PRD 10/11章：成功的共同和解后，旧 caseId、旧 proposalId 和旧结果不能再作用于余额；任何延迟交易均按当前状态检查 | B | contracts/src/ | `DepositEscrow.sol` | AT21/22/49 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-11 | PRD 10/11章：主处理结果被挑战或超时升级后，即使旧交易晚到，也不能跳过 F 生效 | B | contracts/src/ | `DepositEscrow.sol` | AT17/18/49 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-12 | PRD 10/11章：claimDeadline 前不可释放 D-C，claimDeadline 之后不可新增申索；截止边界无重叠 | B | contracts/src/ | `DepositEscrow.sol` | AT09/26 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-13 | PRD 10/11章：平台暂停新建不能冻结旧租约领取；无可升级代理、任意执行或 ownerWithdraw 后门 | B | contracts/src/ | `LeaseFactory.sol`; `DepositEscrow.sol` | AT32/51 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-14 | PRD 10/11章：哈希为零、地址为零、T/L/R/F 地址重复、无效时间配置、无效金额步长均在创建或提交时拒绝 | B | contracts/src/ | `RentBondRules.sol`; Registry/Factory/Escrow | AT02/10/36/40/52 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-15 | PRD 10/11章：CLAIMS 结果必须完整覆盖案件快照中的项目，按固定顺序对应，不允许重复或遗漏 ID | B | contracts/src/ | `DepositEscrow.sol` | AT36 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| SC-16 | PRD 10/11章：同一材料作者的同一 bundleId/version 只能提交一次；回应必须引用已存在的精确承诺值 | B | contracts/src/ | `DepositEscrow.sol` | AT35 | In progress | pending | [local report](../tests/reports/2026-09-21-contracts-local.md) |

AT 的逐条状态与来源完整场景见 [acceptance](acceptance.md)。展示变化 CH01—09 见 [历史 changes](https://github.com/Jenny-qi/RentBond/blob/cef20d4/docs/changes.md)，这些文档变化不代表 FR/SC 业务已完成。

2026-10-02 Worker RPC provider 单元回归 6/6 通过，仅覆盖缺失/空 RPC 结果和链 ID 输入；IT-06 的故障期间投影不被改写尚未跨层执行，其余 Worker 事件/重组用例仍待实现。本次不提升 FR/SC/AT 状态。

## 2026-10-03 Worker runtime evidence

RB-12 now has canonical ABI event discovery, D database synchronization, persisted signed public deadline execution and restart recovery. IT-01–IT-09 passed locally with no skips. See [runtime report](../tests/reports/2026-10-03-worker-runtime.md). This does not mark ATs Verified: Monad full allocation/withdrawal, real PostgreSQL Worker deployment, eight browser E2E scenarios, independent reproduction and nonauthor funds review remain required.

### Worker follow-up review (2026-10-03)

PR #14 is merged into main f843b46. Its implementation CI checks passed; browser E2E still fails as incomplete. Follow-up fixes remove stale health validation/URL logging and restrict Worker networks/intervals; local runtime tests now exercise all eight public action types. See [follow-up report](../tests/reports/2026-10-03-worker-followup.md). No AT is promoted to Verified without independent and deployment evidence.

## 2026-10-03 local browser E2E (Issue #16)

Eight executable Chromium scenarios now cover real page → HTTP API → local EVM funds flows, replacing skipped placeholders without changing the runner's fail-on-skip policy. 700/100/200, final 850/150, timeout 900/100, cancel/reject, same-address external-wallet reauthentication, duplicate withdrawal and local full-service shutdown were executed. See [browser report](../tests/reports/2026-10-03-browser-e2e.md). FR-15–21/24/31–32, SC-06/07/09/12/13 and AT12/16/23/24/26/41/42/51 gain local evidence slices only.

AT41/42/51 and TS05 remain In progress: the EIP-1193 wallet and clean scanner are test substitutes; real Mera/WebAuthn PRF, two-device recovery, public Monad allocation/withdrawal, deployed PostgreSQL and independent funds/reproduction review are not certified. No requirement is promoted to Verified. The previous skipped E2E blocker is addressed by runnable local tests; deployment/device acceptance blockers remain.

2026-10-04 品牌展示：C 页面在导航指定位置接入团队彩色曲线 Logo，移除账户卡片重复图标，保留 favicon 和 Apple touch icon；仅展示调整，不改变 FR/SC 实现及验证状态。素材来源见 [品牌资源](../apps/web/public/brand/README.md)。
