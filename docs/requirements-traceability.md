# 需求追踪表

## 当前状态（2026-10-12）

本地验证通过，尚未完成真机/公网/独立复核：

| 类别 | 状态 |
| --- | --- |
| 类型检查 | 0 错误 |
| Integration | 9 passed / 0 failed / 0 skipped |
| 后端 RPC | Monad 测试网已连接 |
| 前端路由 | 4 个核心页面均 HTTP 200 |
| 生产构建 | 成功 |

以下需求保持 **In progress**，待真机/公网/独立复核完成后方可标记为 Verified：

- Monad 测试网完整押金分配与领取（AT12/16/46）
- Mera passkey 真机同址恢复（AT42/TS05）
- 公网 PostgreSQL + Worker + TLS 部署
- 第二人从新 clone 完整复现（AT34/TS04）
- 独立资金审查

## FR/SC 需求来源

FR（功能需求）和 SC（系统约束）来自 PRD v1.2 第 6/7/10/11 章。
AT（验收测试）场景见 [acceptance.md](acceptance.md)。
展示变化 CH01—09 的历史记录见 [changes 归档](https://github.com/Jenny-qi/RentBond/blob/cef20d4/docs/changes.md)。

## 完整追踪表

完整 FR/SC/AT 逐条追踪（需求 ID、原文位置、实现文件、测试 ID、状态、commit）保留在 [PRD](PRD.md) 附表。
