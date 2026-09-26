# 共享包

E 维护入口，B 审阅金额及合约类型，D 审阅 schema，C 消费。

## 模块结构

```
packages/shared/src/
├── index.ts              # 统一导出（唯一出口）
├── money/                # 金额解析/格式化/步长验证
├── schemas/              # API 输入、错误格式、HTTP 状态码
├── types/                # 租约/案件/交易状态、Role、primitives
├── types/primitives.ts   # Address / Hash / Timestamp 规范化
├── commitments/          # 条款承诺值（Salted keccak256）
└── network/              # 网络配置与终局性适配
```

## 金额约定

| 项目 | 值 |
|------|----|
| MockUSD 精度 | 6 位 |
| 业务步长 | 10,000 单位 = 0.01 MockUSD |
| 传输格式 | 十进制字符串 |
| TS 运算 | `bigint` |
| numeric上限 | 78 位十进制 |

`parseAmount` / `formatAmount` 是唯一转换入口，禁止各端自行复制计算逻辑。

## 状态枚举

**LeaseStatus**（对应 DepositEscrow.Phase）：`AWAITING_ACCEPTANCE` → `AWAITING_FUNDING` → `ACTIVE` → `CHECKOUT_REQUESTED` / `CHECKOUT_CASE` → `CLAIMS_OPEN` → `CLAIMS_REVIEW` → `CLAIM_CASE` → `EXIT_PENDING` → `CANCELLED` / `ALLOCATED` → `CLOSED`

**ClaimResponse**（Tenant 对每项申索的回复，对应 DepositEscrow.ClaimStatus）：`Pending` | `Accepted` | `Disputed` | `Waived` | `Allocated`

**TxStatus**（区分签署/提交/确认中/确认成功/失败/取消）：`AWAITING_SIGNATURE` → `SUBMITTED` → `CONFIRMING` → `CONFIRMED` ↘ `FAILED` | `CANCELLED`

**CaseStatus**（对应 DepositEscrow.CasePhase）：`None` | `Primary` | `Proposed` | `Fallback` | `ExitPending` | `Finalized`

## 类型约束

| 类型 | 规则 |
|------|------|
| `Address` | 小写 `0x` + 40 十六进制字符 |
| `Hash` | `0x` + 64 十六进制字符（bytes32） |
| `Timestamp` | 链上 UTC 秒（Unix 时间戳） |
| `Network` | chainId + 实际 RPC 验证；不一致时停止写入，不回退主网 |

## 条款承诺

条款正文稳定序列化（字段顺序固定）+ `schemaVersion` + 随机 32 字节盐 → `keccak256`。
原文和盐私有保存，承诺哈希（commitment）公开上链。

## 使用示例

```ts
import {
  parseAmount,
  formatAmount,
  isStepAligned,
  DECIMALS,
  LEASE_STATUS,
  CLAIM_RESPONSE,
  normalizeAddress,
  type LeaseSummary,
  type AllocationSnapshot,
} from '@rentbond/shared';

const units = parseAmount('1000.000000'); // 1000000000n
isStepAligned(units); // true
formatAmount(1000000000n); // '1000'

const snapshot: AllocationSnapshot = {
  chainId: 10143,
  contractAddress: normalizeAddress('0xABC...'),
  fundedAmount: '1000000000', // set at fund time, immutable
  unallocated: '200000000',   // Alice's disputed 200
  tenantCredit: '700000000', // Alice's unchallenged 700
  landlordCredit: '100000000', // landlord's accepted 100
  tenantWithdrawn: '0',
  landlordWithdrawn: '0',
  lastSyncedBlock: 12345678n,
  confirmed: false,
  schemaVersion: '1.0.0',
};
```

## 实现状态

RB-02 固定包导出和构建。禁止各端复制金额、截止计算或承诺算法。
