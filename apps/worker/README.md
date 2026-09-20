# 独立 Worker

负责人 E，D 协作事件表和任务持久化。目标独立 Node.js 常驻进程，不能依赖网页请求生命周期。

## 源码结构

```
apps/worker/src/
├── indexer/       # 链上事件读取与幂等回放
├── jobs/          # 截止/到期任务（CLOSE_CLAIMS、FINALIZE_PRIMARY 等）
├── notifications/ # 邮件/SMS 提醒占位（P1）
└── exports/       # 异步导出任务消费
```

## 输入输出

- **输入**：部署块、RPC URL、ABI、持久队列
- **输出**：幂等事件投影、公开推进记录、重试状态
- **补给账户**：与 Worker 账户分离，均无租约角色私钥

## 关键不变量

- 停止 Worker 不得冻结合约退出
- 重启不能重复分配（幂等键：chainId + txHash + logIndex）
- 任务期限来自链上参数，不因重试延长
- 延迟推进不重置起算点

## 任务类型

| 类型 | 触发条件 | 说明 |
|------|----------|------|
| `CLOSE_CLAIMS` | claimDeadline 到期 | 一次性关闭申索窗口，分配已认可/未申索部分 |
| `FINALIZE_PRIMARY` | primaryDeadline 到期 | 无挑战则生效；被挑战则失效 |
| `FINALIZE_FALLBACK` | fallbackDeadline 到期 | 备用处理人结果生效 |
| `FINALIZE_TIMEOUT` | timeoutAt 到期 | 超时退出，争议款归租客 |
| `EXPIRE_ESCROW` | hardEndAt 到期 | 最终退出，落实已成立金额权利 |
| `WITHDRAW_UNALLOCATED` | 解散后 | 将剩余 U 退还租客 |

## 实现状态

- RB-12：事件回放、重组回滚、同链备用 RPC、去重
- P1：邮件通知

## 命令

```sh
pnpm worker:dev   # RB-12 后可运行
```
