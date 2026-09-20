# 共享包

E 维护入口，B 审阅金额及合约类型，D 审阅 schema，C 消费。

## 模块结构

```
packages/shared/src/
├── index.ts              # 统一导出
├── money/                # 金额解析/格式化/步长验证
├── schemas/              # API 输入、错误格式、HTTP 状态码
├── types/                # 租约/案件/交易状态、Role、primitives
├── commitments/          # 条款承诺值（Salted keccak256）
└── network/              # 网络配置与终局性适配
```

## 金额约定

- MockUSD 底层 **6 位精度**
- 业务步长 **10,000 单位** = 0.01 MockUSD
- 所有金额以十进制字符串传输，TS 用 `bigint` 运算
- `Amount` = JSON 十进制整数字符串；TS `bigint`
- `parseAmount` / `formatAmount` 是唯一转换入口

## 类型约束

- `Address`：规范化的 EVM 地址（小写 0x + 40 十六进制）
- `Hash`：bytes32，十六进制
- `Timestamp`：链上 UTC 秒
- `Network`：chainId + 实际 RPC 验证；不一致时停止写入，不回退主网

## 条款承诺

条款正文稳定序列化（字段顺序固定）+ `schemaVersion` + 随机 32 字节盐 → `keccak256`。
原文和盐私有保存，承诺哈希（commitment）公开上链。

## API 交易状态

区分六种状态，不得用交易 hash 直接称"成功"：

```
AWAITING_SIGNATURE → SUBMITTED → CONFIRMING → CONFIRMED
                                        ↘ → FAILED
                  ↘ → CANCELLED
```

## 实现状态

RB-02 固定包导出和构建。禁止各端复制金额、截止计算或承诺算法。

## 使用示例

```ts
import { parseAmount, formatAmount, isStepAligned, DECIMALS } from '@rentbond/shared';

const units = parseAmount('1000.000000'); // 1000000000n
isStepAligned(units); // true
formatAmount(1000000000n); // '1000'
```
