# 独立 Worker

负责人 E，D 协作事件表和任务持久化。目标独立 Node.js 常驻进程，不能依赖网页请求生命周期。

## 源码结构

```
apps/worker/src/
├── main.ts          # 进程入口，配置加载和主循环
├── index.ts         # 模块导出
├── indexer/
│   ├── index.ts     # 事件常量、EventKey、幂等键、IndexerConfig
│   ├── events.ts    # 类型化事件参数接口（从 ABI 生成）
│   ├── allocation.ts # 事件→AllocationState 投影（资金守恒）
│   ├── projection.ts# 事件→LeaseStatus 投影（Phase 映射）
│   ├── contracts.ts # Escrow/Factory 函数调用桩
│   └── providers.ts # viem RPC 客户端配置
├── jobs/            # 截止/到期任务（CLOSE_CLAIMS、FINALIZE_PRIMARY 等）
│   └── scheduler.ts  # 事件→JobTrigger 决策，decideJobTrigger/createJob
├── notifications/    # 邮件/SMS 提醒占位（P1）
└── exports/         # 异步导出任务消费
```

## 入口

```sh
node apps/worker/src/main.ts   # RB-12 后可用（Node 24 原生支持 TS）
```

环境变量：`RPC_URL`、`RPC_FALLBACK_URL`、`CHAIN_ID`、`FACTORY_ADDRESS`、
`RESOLVER_REGISTRY_ADDRESS`、`DATABASE_URL`、`PERSISTENCE_PATH`、
`WORKER_BATCH_SIZE`、`WORKER_POLL_INTERVAL_MS`。

## 关键不变量

| 规则 | 说明 |
|------|------|
| 停止 Worker ≠ 冻结合约退出 | 合约是无需许可的，任何人都可推进 |
| 重启不能重复分配 | 幂等键：chainId + contractAddress + txHash + logIndex |
| 任务期限来自链上 | 不因重试延长；延迟推进不重置起算点 |
| 补给账户分离 | Worker 账户无租约角色私钥 |

## 事件类型（indexer）

`TermsAccepted` | `LeaseCancelled` | `Funded` | `CreditAllocated` | `Withdrawn` |
`ClaimsOpened` | `ClaimsSubmitted` | `ClaimResponded` | `ClaimWaived` | `ClaimsClosed` |
`CaseOpened` | `DecisionProposed` | `CaseEscalated` | `DecisionFinalized` |
`ServiceTimedOut` | `TimeoutAllocated` | `EscrowExpired` |
`SettlementProposed` | `SettlementConfirmed` | `EvidenceCommitted` | `EvidenceAcknowledged` |
`CheckoutRequested` | `CheckoutResponded` | `CheckoutCaseOpened` | `CheckoutCaseResolved`

工厂事件：`LeaseCreated` | `NewLeasesPaused`

## 事件→金额投影

| 事件 | 影响的分配字段 | 说明 |
|------|---------------|------|
| `Funded` | `fundedAmount` + `unallocated` | 初始化快照 |
| `CreditAllocated` | `tenantCredit` / `landlordCredit` | 按受益人路由 |
| `Withdrawn` | `tenantWithdrawn` / `landlordWithdrawn` | 领取后减少 credit |
| `ClaimsClosed` | `unallocated` ↓ `tenantCredit` + `landlordCredit` | 未申索→租客，已认可→房东 |
| `SettlementConfirmed` | `unallocated` ↓ `tenantCredit` + `landlordCredit` | 和解覆盖争议金额 |
| `EscrowExpired` | `unallocated` → `tenantCredit` | 超时退出：剩余归租客 |

守恒不变式：`fundedAmount = unallocated + tenantCredit + landlordCredit + tenantWithdrawn + landlordWithdrawn`

## 事件→JobTrigger

| 触发事件 | 创建的 Job | triggerBlock 来源 |
|---------|-----------|-----------------|
| `ClaimsOpened` | `CLOSE_CLAIMS` | `claimDeadline` |
| `CaseOpened` | `FINALIZE_PRIMARY` | 从链上案件数据读取 |
| `CaseEscalated` | `FINALIZE_FALLBACK` | `fallbackDeadline` |
| `DecisionFinalized` | `WITHDRAW_UNALLOCATED` | `triggerBlock + 1` |
| `ServiceTimedOut` | `FINALIZE_TIMEOUT` | `timeoutAt` |
| `EscrowExpired` | `EXPIRE_ESCROW` | `triggerBlock + 1` |

## 任务类型（jobs）

| 类型 | 触发条件 | 说明 |
|------|----------|------|
| `CLOSE_CLAIMS` | claimDeadline 到期 | 一次性关闭窗口，分配已认可/未申索 |
| `FINALIZE_PRIMARY` | primaryDeadline 到期 | 无挑战则生效；被挑战则失效 |
| `FINALIZE_FALLBACK` | fallbackDeadline 到期 | 备用处理人结果生效 |
| `FINALIZE_TIMEOUT` | timeoutAt 到期 | 超时退出，争议款归租客 |
| `EXPIRE_ESCROW` | hardEndAt 到期 | 最终退出，落实已成立金额权利 |
| `WITHDRAW_UNALLOCATED` | 全部结算后 | 将剩余 U 退还租客 |

## 实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| `indexer/events.ts` | ✅ 类型完整 | 25 个 Escrow 事件 + 2 个 Factory 事件的类型化参数接口 |
| `indexer/allocation.ts` | ✅ 投影逻辑 | 资金守恒投影：Funded→ClaimsClosed→Settlement/Timeout |
| `indexer/projection.ts` | ✅ Phase 映射 | 合约 Phase→LeaseStatus，含 phaseToStatus 辅助 |
| `indexer/contracts.ts` | ⚠️ 调用桩 | 7 个 Worker 操作（closeClaims 等），RB-12 替换为 viem |
| `indexer/providers.ts` | ⚠️ 客户端桩 | viem public/wallet client，RB-12 实现 |
| `jobs/scheduler.ts` | ✅ 调度逻辑 | decideJobTrigger/createJob，6 种事件触发器 |
| `jobs/` | ⚠️ 执行逻辑 | Job/JobType/JobStatus 已定义，executeJob RB-12 |
| `notifications/` | ⚠️ 占位 | P1 |
| `exports/` | ⚠️ 占位 | RB-12 |

## 启动流程

```
pnpm infra:up         # RB-02：启动数据库和存储
pnpm chain:local      # RB-03：启动本地链
pnpm fixtures:seed    # RB-08：植入测试数据
pnpm worker:dev       # RB-12：启动 Worker
```
