# 独立 Worker

负责人 E，D 协作事件表和任务持久化。目标独立 Node.js 常驻进程，不能依赖网页请求生命周期。

## 源码结构

```
apps/worker/src/
├── main.ts        # 进程入口，配置加载和主循环
├── index.ts       # 模块导出
├── indexer/       # 链上事件读取与幂等回放
├── jobs/          # 截止/到期任务（CLOSE_CLAIMS、FINALIZE_PRIMARY 等）
├── notifications/  # 邮件/SMS 提醒占位（P1）
└── exports/       # 异步导出任务消费
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

- **RB-12**：事件回放、重组回滚、同链备用 RPC、去重
- **P1**：邮件通知

## 启动流程

```
pnpm infra:up         # RB-02：启动数据库和存储
pnpm chain:local      # RB-03：启动本地链
pnpm fixtures:seed    # RB-08：植入测试数据
pnpm worker:dev       # RB-12：启动 Worker
```
