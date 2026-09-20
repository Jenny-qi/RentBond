# 跨模块测试

负责人 E；B 提供合约测试，D 提供权限用例，C 提供账户/页面流程。

## 测试结构

```
tests/
├── README.md              # 本文件
├── runner.ts             # 测试运行器（integration / e2e / all）
├── integration/
│   └── suite.ts          # IT-01 — IT-08（RB-12 后可运行）
└── e2e/
    └── suite.ts          # E2E-01 — E2E-08（RB-12/RB-13 后可运行）
```

## 当前状态

骨架检查不是业务测试。真实用例在 RB-12/RB-13 实现后运行。

## 集成测试（IT-01 — IT-08）

| ID | 场景 | 前置 |
|----|------|------|
| IT-01 | SIWE nonce 重放被拒绝 | RB-08 |
| IT-02 | 跨租约 ACL：租客不能访问他租约资料 | RB-08 |
| IT-03 | 事件幂等：同一链上事件只处理一次 | RB-12 |
| IT-04 | 事件回滚：非规范区块重组后正确重放 | RB-12 |
| IT-05 | Worker 停启不重复分配 | RB-12 |
| IT-06 | RPC 故障：读取失败不误当余额为零 | RB-12 |
| IT-07 | 测试 Gas 补给限额不超 | RB-08 |
| IT-08 | SIWE 会话 24h 过期强制重新认证 | RB-08 |

## E2E 测试（E2E-01 — E2E-08）

| ID | 场景 | 前置 |
|----|------|------|
| E2E-01 | 全流程：邀请→入金→交接→申索→700/100/200→领取 | RB-12 |
| E2E-02 | 争议 200 → 50/150 终局分配 | RB-07 |
| E2E-03 | 服务超时：900/100 退出政策 | RB-06 |
| E2E-04 | 入金前取消：无状态变化 | RB-09 |
| E2E-05 | 拒绝签署：交易未提交 | RB-09 |
| E2E-06 | 同一地址账户恢复 | RB-08 |
| E2E-07 | 重复领取：第二次静默失败（不重复付款） | RB-12 |
| E2E-08 | AT51：全停后从链上状态恢复，第三方付 Gas | RB-13 |

## 运行

```sh
node tests/runner.ts integration  # RB-12 后
node tests/runner.ts e2e         # RB-12/RB-13 后
node tests/runner.ts all         # 全部
```

## 报告

运行结果输出到 `tests/reports/`（不含敏感材料），格式：

```
PASS IT-01: SIWE nonce replay is rejected
  → evidence: tests/reports/it-01-2026-09-20.log
```

## 验收

全部 AT 场景（AT01—52）均有真实结果，第二人复核；未通过不得算完成。详见 [docs/acceptance.md](../docs/acceptance.md)。
