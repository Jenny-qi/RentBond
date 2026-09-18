# 需求追踪表

FR/SC 来自 v1.2，初始映射用于计划，尚无实现证据。implementationFiles 先为 `—`，不能把目录占位视为实现。Verified 需要 commit、测试及证据。

| requirementId | 原文位置与摘要 | owner | plannedLocation | implementationFiles | testIds | status | commit | evidenceLink |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-01 | PRD 6/7章：界面始终显示“Monad 测试网 · 测试资产，无现金价值” | C | apps/web/src/features/ | — | AT41 | Not started | — | — |
| FR-02 | PRD 6/7章：本版押金 D 范围为 1—10,000 MockUSD，前端输入最多 2 位小数，合约接受以 0.01 MockUSD 为最小业务单位的金额 | B/C | contracts/src/; packages/shared/src/ | — | AT02/10/36 | Not started | — | — |
| FR-03 | PRD 6/7章：只允许指定租客从其地址一次存入精确的 D | B | contracts/src/ | — | AT01/02/38/40 | Not started | — | — |
| FR-04 | PRD 6/7章：合约只接受部署时固定的 MockUSD 地址，不支持收取转账税或余额自动变化的代币 | B | contracts/src/ | — | AT02/24/25 | Not started | — | — |
| FR-05 | PRD 6/7章：分配形成“可领取余额”；领取交易确认后才是“已领取” | B/C | contracts/src/; apps/web/src/features/ | — | AT03/12/23 | Not started | — | — |
| FR-06 | PRD 6/7章：房东创建可编辑草稿，填写租赁关系和约定，选择有效服务方案 | C/D | apps/web/src/app/; apps/web/src/server/ | — | AT27/41/52 | Not started | — | — |
| FR-07 | PRD 6/7章：房东检查条款后部署租约合约 | B/C | contracts/src/; apps/web/src/features/ | — | AT01/02/37/38/40 | Not started | — | — |
| FR-08 | PRD 6/7章：租客先查看完整金额、规则和收款合约，再确认存入 | B/C | contracts/src/; apps/web/src/features/ | — | AT03/41/43 | Not started | — | — |
| FR-09 | PRD 6/7章：入金前任一当事人可取消该约定；取消后不能再接受或入金 | B | contracts/src/ | — | AT01/02/26 | Not started | — | — |
| FR-10 | PRD 6/7章：入住清单至少包含房间／物品名称、状况描述、文件、提交者、提交时间和对方状态 | C/D | apps/web/src/features/; apps/web/src/server/ | — | AT27/33/35 | Not started | — | — |
| FR-11 | PRD 6/7章：每次提交形成新版本，已提交的正文和文件不能被覆盖 | B/D | contracts/src/; apps/web/src/server/ | — | AT33/35 | Not started | — | — |
| FR-12 | PRD 6/7章：维修记录、租期内事件和退租清单复用该结构 | C/D | apps/web/src/features/; apps/web/src/server/ | — | AT33/35 | Not started | — | — |
| FR-13 | PRD 6/7章：任一方可请求确认提前交接，提交实际日期和材料摘要；另一方认可或有效处理结果确认后，可提前开启申索 | B/C | contracts/src/ | — | AT05/06/45/50 | Not started | — | — |
| FR-14 | PRD 6/7章：提前交接请求存在异议或逾期未回应，可进入 CHECKOUT 案件 | B | contracts/src/ | — | AT07/45/50 | Not started | — | — |
| FR-15 | PRD 6/7章：CHECKOUT 有效结果仅为提前交接成立或不成立 | B | contracts/src/ | — | AT08/50 | Not started | — | — |
| FR-16 | PRD 6/7章：申索窗口内，房东可以准备最多 10 项扣款，一次性在链上提交最终清单；每项必须金额为正、带证据清单承诺值，累计金额不超过 D | B/C | contracts/src/ | — | AT10/11/26 | Not started | — | — |
| FR-17 | PRD 6/7章：扣款的私有正文包含类别、金额、理由、对应租约条款、入住和退租资料引用、票据／报价和解释 | C/D | apps/web/src/features/; apps/web/src/server/ | — | AT11/27/33 | Not started | — | — |
| FR-18 | PRD 6/7章：清单提交后可追加证据版本，不能修改原金额与理由版本 | B/D | contracts/src/; apps/web/src/server/ | — | AT11/35 | Not started | — | — |
| FR-19 | PRD 6/7章：申索窗口关闭后，不存在有效清单即 C=0；已有清单则 C 为固定申索总额 | B | contracts/src/ | — | AT09/12/14/26 | Not started | — | — |
| FR-20 | PRD 6/7章：租客可在清单提交后至统一 responseDeadline 前，逐项“认可”或“提出异议”；认可需要单独确认金额及不可撤销性 | B/C | contracts/src/ | — | AT12/13/26 | Not started | — | — |
| FR-21 | PRD 6/7章：有异议的项目可以附说明 | B | contracts/src/ | — | AT13/26 | Not started | — | — |
| FR-22 | PRD 6/7章：房东在正式 CLAIMS 案件创建前可撤回尚未分配项目；窗口关闭前撤回的金额在 closeClaims 时归租客，窗口关闭后撤回则即时归租客 | B | contracts/src/ | — | AT14/15 | Not started | — | — |
| FR-23 | PRD 6/7章：回应截止后，未分配的全部有效申索统一进入一宗 CLAIMS 案件，避免为 10 个项目启动 10 个独立处理流程 | B | contracts/src/ | — | AT13/36 | Not started | — | — |
| FR-24 | PRD 6/7章：案件记录 caseId、类型、金额快照与固定期限 | B/D | contracts/src/; apps/web/src/server/ | — | AT27/44/47 | Not started | — | — |
| FR-25 | PRD 6/7章：证据窗口结束后，R 可以提出一次结果 | B/C | contracts/src/ | — | AT16/36 | Not started | — | — |
| FR-26 | PRD 6/7章：R 提出结果后，T、L 任一方可在 T_challenge 内请求备用处理，附理由承诺值 | B/C | contracts/src/ | — | AT16/17/26 | Not started | — | — |
| FR-27 | PRD 6/7章：R 未在 primaryDeadline 前提出结果时，任何人可升级 F，备用起点固定为 primaryDeadline；有及时挑战时起点为 challengedAt | B | contracts/src/ | — | AT18/47 | Not started | — | — |
| FR-28 | PRD 6/7章：F 在固定备用起点后的前 2 天接收补充材料，其后至 fallbackDeadline 前可提交一次最终结果，仍受金额与理由要求约束 | B/D | contracts/src/; apps/web/src/server/ | — | AT19/20/44 | Not started | — | — |
| FR-29 | PRD 6/7章：CLAIMS 的 F 未按期提交有效结果，进入 ExitPending；到 fallbackDeadline + T_exitNotice 后，任何人可调用 finalizeTimeout，将尚无有效支持的争议款计入租客可领取余额 | B/E | contracts/src/; apps/worker/src/ | — | AT20/46/47/48/49 | Not started | — | — |
| FR-30 | PRD 6/7章：成功入金后、U>0 且尚未达到有效 timeoutAt/hardEndAt 时，双方可对当前未分配金额共同和解 | B/C | contracts/src/ | — | AT21/22/49 | Not started | — | — |
| FR-31 | PRD 6/7章：T/L 可调用 withdraw；任何人也可调用 withdrawFor(固定 T 或 L 地址)承担交易费用，收款人不能由调用者改变 | B/E | contracts/src/; scripts/ | — | AT04/23/24/51 | Not started | — | — |
| FR-32 | PRD 6/7章：U=0 时显示“分配完成”；U+CT+CL=0 时显示“全部领取完成” | B/C | contracts/src/; apps/web/src/features/ | — | AT23/46/47 | Not started | — | — |
| FR-33 | PRD 6/7章：导出包包含条款版本、角色地址、各方确认记录、材料清单与可访问原件、申索回应、处理理由、资金流水和核验说明 | D/E | apps/web/src/server/; apps/worker/src/ | — | AT27/33 | Not started | — | — |
| FR-34 | PRD 6/7章：正式提交的材料按清单打包，由提交者钱包调用 recordEvidence 记录 bundleId、版本和承诺值；对方调用 acknowledgeEvidence 表示认可或异议 | B/C/D | contracts/src/; apps/web/src/server/ | — | AT33/35 | Not started | — | — |
| SC-01 | PRD 10/11章：服务端保存部署区块与同步检查点，按区块范围抓取事件；重启后从检查点回溯一段区间重放 | E | apps/worker/src/; packages/shared/src/ | — | AT29 | Not started | — | — |
| SC-02 | PRD 10/11章：确认策略由 network-adapter 实现 | E | apps/worker/src/; packages/shared/src/ | — | AT29/30 | Not started | — | — |
| SC-03 | PRD 10/11章：页面出现“已确认”需满足配置的确认策略；“钱包到账”还需成功领取事件与余额核验 | E | apps/worker/src/; packages/shared/src/ | — | AT03/29/30 | Not started | — | — |
| SC-04 | PRD 10/11章：主 RPC 失败时切换经过同网络验证的备用 RPC；两个端点 chainId 不一致时立即禁用写操作 | E | apps/worker/src/; packages/shared/src/ | — | AT30 | Not started | — | — |
| SC-05 | PRD 10/11章：Worker 采用持久任务与幂等公开函数；startScheduledSettlement、案件超时推进、finalizeTimeout、expireEscrow 与 withdrawFor 不依赖 Worker、数据库或运营者批准 | E | apps/worker/src/; packages/shared/src/ | — | AT31/47/51 | Not started | — | — |
| SC-06 | PRD 10/11章：任何人无法把合约资金分配给 T、L 以外地址；R、F、O 不存在资金受益路径 | B | contracts/src/ | — | AT04/51 | Not started | — | — |
| SC-07 | PRD 10/11章：所有金额非负，累计分配不超过 D，每项分配不超过申索额；分配和领取分别记账 | B | contracts/src/ | — | AT12/23/24/36/46 | Not started | — | — |
| SC-08 | PRD 10/11章：申索总额的上限由合约检查，不能只靠网页 | B | contracts/src/ | — | AT10/36 | Not started | — | — |
| SC-09 | PRD 10/11章：只有经过资金交易成功确认的租约可进入 Active；任何失败的转账不得留下已入金标记 | B | contracts/src/ | — | AT02/03 | Not started | — | — |
| SC-10 | PRD 10/11章：成功的共同和解后，旧 caseId、旧 proposalId 和旧结果不能再作用于余额；任何延迟交易均按当前状态检查 | B | contracts/src/ | — | AT21/22/49 | Not started | — | — |
| SC-11 | PRD 10/11章：主处理结果被挑战或超时升级后，即使旧交易晚到，也不能跳过 F 生效 | B | contracts/src/ | — | AT17/18/49 | Not started | — | — |
| SC-12 | PRD 10/11章：claimDeadline 前不可释放 D-C，claimDeadline 之后不可新增申索；截止边界无重叠 | B | contracts/src/ | — | AT09/26 | Not started | — | — |
| SC-13 | PRD 10/11章：平台暂停新建不能冻结旧租约领取；无可升级代理、任意执行或 ownerWithdraw 后门 | B | contracts/src/ | — | AT32/51 | Not started | — | — |
| SC-14 | PRD 10/11章：哈希为零、地址为零、T/L/R/F 地址重复、无效时间配置、无效金额步长均在创建或提交时拒绝 | B | contracts/src/ | — | AT02/10/36/40/52 | Not started | — | — |
| SC-15 | PRD 10/11章：CLAIMS 结果必须完整覆盖案件快照中的项目，按固定顺序对应，不允许重复或遗漏 ID | B | contracts/src/ | — | AT36 | Not started | — | — |
| SC-16 | PRD 10/11章：同一材料作者的同一 bundleId/version 只能提交一次；回应必须引用已存在的精确承诺值 | B | contracts/src/ | — | AT35 | Not started | — | — |

AT 的逐条状态与来源完整场景见 [acceptance](acceptance.md)。展示变化 CH01—09 见 [changes](changes.md)，这些文档变化不代表 FR/SC 业务已完成。
