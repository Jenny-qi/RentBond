# 需求追踪表

## 2026-10-13 Mera signing regression

RB-08 / Mera transaction signing: local signer preservation fixed; regression
tests verify signed transaction sender, chain, target and calldata, plus external
wallet compatibility (10 focused tests passed, zero skipped). Public deployment
and real Mera transaction acceptance remain pending, not Verified. See the
[report](../tests/reports/2026-10-13-mera-signing-fix.md).

## 状态总览

需求状态：Not started / In progress / Blocked / Verified
运行结果：Not run / Passed / Failed

Verified 必须有固定 commit、命令、环境与证据；失败记录不可删除或改成通过。

## FR/SC 来源

FR（功能需求）和 SC（系统约束）来自 PRD v1.2 第 6/7/10/11 章。
完整 FR/SC/AT 逐条追踪（需求 ID、原文位置、实现文件、测试 ID、状态、commit）保留在 [PRD](PRD.md) 附表。

## 当前验证进度

| 类别 | 状态 |
| --- | --- |
| 本地类型检查 | 0 错误 |
| 本地 Integration | 9 passed / 0 failed / 0 skipped |
| 本地 E2E（Chromium） | 8 passed |
| 线上 API 健康 | 5/5 通过 |
| 线上公网切片 | SIWE、私有上传/扫描/导出/权限隔离通过 |
| 生产构建 | 成功 |

## 待完成（真机/公网/独立复核）

- Monad 测试网完整押金分配与领取
- Mera passkey 真机同址恢复
- 公网 PostgreSQL + Worker + TLS 部署
- 第二人从新 clone 完整复现
- 独立资金审查
- 3 分钟演示视频

展示变化 CH01—09 历史记录见 [changes 归档](https://github.com/Jenny-qi/RentBond/blob/cef20d4/docs/changes.md)。
