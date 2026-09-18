# 共享数据契约

负责人 E；金额与合约类型由 B 审阅，服务端 schema 由 D 审阅。具体 TS 实现待 RB-02/04/08。

## 基础约定

| 类型 | 表达 | 规则 |
| --- | --- | --- |
| Amount | JSON 十进制整数字符串；TS bigint | MockUSD 底层 6 位精度，业务步长 10000；不使用 Number 运算 |
| Timestamp | 链上 UTC 秒 | 边界由链时间决定，UI 显示当地时间/UTC/倒计时 |
| Address | 经校验的 EVM 地址 | 比较前统一规范化；UI 短显示、详情全地址 |
| Hash | bytes32 十六进制 | 对应 schemaVersion 与精确版本，不允许零哈希 |
| Network | chainId + 实际 RPC 验证 | 两端不一致停止写入，不回退主网 |

```json
{
  "fixtureOnly": true,
  "decimals": 6,
  "fundedAmount": "1000000000",
  "unallocated": "200000000",
  "tenantCredit": "700000000",
  "landlordCredit": "100000000",
  "tenantWithdrawn": "0",
  "landlordWithdrawn": "0"
}
```

这只是 AT12 的虚构金额向量。真实响应还需 chainId、contractAddress、lastSyncedBlock、确认状态和 revision。不得由前端传金额字段来覆盖投影。

## 模块边界

`money/` 放解析/格式化/步长检查；`schemas/` 放 API 输入与条款结构；`types/` 放租约/案件/交易状态；`commitments/` 放稳定序列化与测试向量；`network/` 放网络及终局性适配。共享模块不得导入数据库密钥或服务器专用配置。

条款与清单规范化 UTF-8，明确 schemaVersion、稳定字段次序，附随机 32 字节盐再 keccak256；文件本体 SHA-256。原文与盐私有保存，不能手工在各端各算一版。B/D/E 共同固定向量后再写实现。

API 交易状态应区分等待签署、已提交、确认中、确认成功、确认失败和用户取消；凭交易 hash 不得称“成功”。
