# 验收清单

## 当前状态（2026-10-12）

- 类型检查：`./node_modules/.bin/tsc --noEmit` 0 错误
- 集成测试：9 passed / 0 failed / 0 skipped
- 后端健康：`/api/health` 返回 `rpc: true`，Monad 测试网已连接
- 前端页面：`/`、`/leases`、`/login`、`/resolver` 均 HTTP 200
- 生产构建：`npx next build` 成功，无阻断错误

## 待验收项

以下项目在本地实现证据已积累，但真机、公网、独立复核仍待完成，本次不标记为 Verified：

| 类别 | 项目 |
| --- | --- |
| 链上闭环 | Monad 测试网完整 850/150 分配与领取 |
| 账户恢复 | Mera passkey 同址恢复、跨设备恢复 |
| 部署 | 公网 PostgreSQL + Worker + TLS + 私有文件 ACL |
| 独立复现 | 第二人从新 clone 完整运行 |
| 资金审查 | 合格成员或导师的独立资金规则评审 |
| 视频 | 不超过 3 分钟的真实操作演示 |

---

## 需求追踪

需求状态：Not started / In progress / Blocked / Verified。
运行结果：Not run / Passed / Failed。

Verified 必须有固定 commit、命令、环境与证据；失败记录不可删除或改成通过。

### 前置技术试验

| ID | 试验 | 负责人 | 状态 |
| --- | --- | --- | --- |
| TS01 | 网络、四账户、错误链和拒签 | B/E | In progress |
| TS02 | 最小真实资金闭环与权限 | B/E | In progress |
| TS03 | SIWE 与私有文件越权拒绝 | D/C | In progress |
| TS04 | 独立成员从新 clone 完整运行 | E | In progress |
| TS05 | passkey 同地址恢复、费用、取消不执行 | C/D | In progress |

### 业务用例（节选关键项）

| ID | 场景 | 状态 |
| --- | --- | --- |
| AT12 | 1,000 押金，申索 100+200，认可 100、争议 200 → T 可领 700、L 可领 100 | In progress |
| AT16 | 主结果给争议 200 中的 50 给 L → 无挑战到期后 T 增 150，L 增 50 | In progress |
| AT23 | 同一领取重复调用 → 不重复分配或支付 | In progress |
| AT34 | 从全新 clone 启动并执行核心流程 | Not started |
| AT42 | 换兼容设备恢复；另建 passkey 产生不同地址 | In progress |
| AT46 | T 已领 700、L 已领 100、争议 200；R/F 均超时 → 200 给 T | In progress |
| AT51 | 全站停止后从原账户/链上记录恢复 | In progress |

完整业务用例表见 [PRD](PRD.md) 第 15 章。

---

## 发布门槛

全部 P0、关键权限/金额/边界/恢复通过，第二人复核；没有执行的不写通过。测试网交易、ABI、条款与 hardEndAt 对齐；主 Demo 三角色不能豁免备用与异常验收。
