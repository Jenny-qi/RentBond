# 合约接口与状态规则（B → C/D/E）

更新时间：2026-09-21。当前源码与测试已实现，ABI 仍须在合并 commit 固定后从构建产物导出；尚无 Monad 测试网地址。

## 不可绕过的业务规则

| 项目 | 链上规则 |
| --- | --- |
| 角色 | 每份租约固定一个 T、L、R、F，四个地址互异；R/F 不能成为资金受益人 |
| 资产 | 固定一个 6 位小数 MockUSD 地址；测试资产无现金价值 |
| 金额 | 押金 1—10,000 MockUSD；业务金额最小单位 0.01；最多 10 项申索 |
| 服务授权 | R/F 只需在入金前分别接受同一不可变服务方案，不逐租约签字；T/L 仍逐租约确认 |
| 期限 | 时间参数属于服务方案并纳入哈希；L 不能自填。`hardEndAt` 由 `leaseEndAt` 与完整配置推导 |
| 受益人 | 资金只能记入部署时固定的 T/L；`withdrawFor` 可由任何人付 gas，但仍只付给固定地址 |
| 管理权限 | Escrow 不可升级，无管理员提款、任意执行、收益或换受益人入口 |

默认超时政策是 `keccak256("TIMEOUT_RETURN_UNAWARDED_TO_TENANT")`：主备程序与退出通知都耗尽后，只把仍无有效支持的待定金额记给 T；已认可或已生效金额不反转。这是双方入金前接受的合约政策，不是对现实责任的法律判断。

## 合约关系

| 合约 | 关键入口 | 消费者 |
| --- | --- | --- |
| `MockUSD` | `mint`、ERC-20 `approve/transfer/transferFrom` | C 入金；仅测试铸币操作人可 mint |
| `ResolverRegistry` | `createProfile`、`acceptProfile`、`revokeForNewFunding`、`isEligible` | C/D 服务方案；Factory/Escrow 校验 |
| `LeaseFactory` | `createLease`、`pauseNewLeases` | C 创建；E 监听 `LeaseCreated` |
| `DepositEscrow` | 接受、入金、材料、交接、申索、案件、和解、退出、领取 | C 页面、D 投影、E Worker/恢复工具 |

`DepositEscrowDeployer` 是无状态的字节码拆分组件。任何人直接调用它都只能得到 `factory=调用者` 的独立实例；正式租约必须以 Factory 的 `LeaseCreated` 事件及 Escrow 的 `factory()` 交叉核验。

## Registry 冻结结构

`TimingConfig` 字段顺序：

```text
checkoutResponse, claim, response, evidence, primary,
challenge, fallbackEvidence, fallbackResolver, exitNotice
```

正常方案值为 `7d, 7d, 7d, 3d, 7d, 3d, 2d, 7d, 3d`。`fallbackEvidence` 是 F 总窗口内的前段，不再额外加到 hardEnd。

`ServiceProfile` 字段顺序：

```text
profileId, serviceTermsHash, ruleVersion,
primaryResolver, fallbackResolver, token,
maxDeposit, maxLeaseEnd, acceptUntil,
timingProfileId, timeoutPolicy, timing
```

- `timingProfileId = keccak256(abi.encode(timing, timeoutPolicy))`。
- `profileId` 由 Registry 的 `computeProfileId(profile)` 计算；计算不包含 `profileId` 自身，包含其他所有字段。
- Profile 内容创建后不可修改；R/F 分别 `acceptProfile(profileId)` 后才可用。
- R 或 F 可调用 `revokeForNewFunding` 关闭该 Profile。已创建但未入金的 Escrow 在 `fund` 时重新校验并拒绝；已入金 Escrow 继续使用快照。

## Factory 输入

`createLease(CreateLeaseParams)` 只接受：

```text
serviceProfileId, tenant, landlord, depositAmount,
leaseEndAt, termsHash, acceptDeadline
```

调用者必须等于 `landlord`。Token、R/F、ruleVersion、时间配置、timeoutPolicy、serviceTermsHash 和 hardEndAt 全部来自 Registry，前端不得再提交一套重复值。创建成功以 `LeaseCreated(leaseId, escrow, landlord, tenant, serviceProfileId, termsHash, hardEndAt)` 为依据。

## Escrow 状态与调用

| 阶段 | 允许的主要动作 | 退出条件 |
| --- | --- | --- |
| `AwaitingAcceptance` | T `acceptTerms`；T/L `cancelUnfunded` | 接受后 AwaitingFunding；取消/过期后 Cancelled |
| `AwaitingFunding` | T 精确 `fund(D)`；T/L 可取消 | 真实余额增加 D 后 Active |
| `Active` | 材料、共同和解、提前交接请求 | 双方同意或有效 CHECKOUT 结果提前开始；否则 leaseEndAt 开始 |
| `CheckoutRequested` | 对方 `respondCheckout`；无人回应或否定可开案 | 同意 → ClaimsOpen；异议 → CheckoutCase；leaseEndAt → 预定结算 |
| `CheckoutCase` | R 结果、挑战、F、超时推进 | 成立 → ClaimsOpen；不成立 → Active；到 leaseEndAt → 预定结算 |
| `ClaimsOpen` | L 一次提交清单；T 回应；L 撤回 | claimDeadline 后 `closeClaims` |
| `ClaimsReview` | T 在 responseDeadline 前回应；L 在开案前撤回 | responseDeadline 后剩余 U 进入 ClaimCase |
| `ClaimCase` | R 提案、挑战、F；双方仍可共同和解 | 有效结果、和解或超时退出 |
| `ExitPending` | 旧 credit 可领；双方在 timeoutAt 前仍可共同和解 | timeoutAt 后剩余 U 给 T |
| `Allocated` / `Closed` | 固定 T/L `withdraw` 或任何人 `withdrawFor(T/L)` | 两方 credit 均领取后 Closed |

所有“提交”采用 `now < deadline`，所有相应“推进”采用 `now >= deadline`。公开推进函数是幂等或受当前状态保护；Worker 只是调用者之一，不拥有特殊资金权限。

## 700 / 100 / 200 的精确时点

1. L 在 claimDeadline 前一次提交 100 + 200。
2. 到 claimDeadline，`closeClaims` 才把未申索的 700 记为 T credit；窗口关闭前只可显示预计值。
3. T 认可 100 后，若已经 close，该 100 立即成为 L credit；200 保持 `unallocated`。
4. responseDeadline 后，200 才作为 CLAIMS 案件固定快照。
5. R 给 L 50 的提案不会立即转钱；无挑战且到 challengeDeadline 后 `finalizePrimary`，T 再得 150、L 再得 50。

`Accounting` 必须始终满足：

```text
unallocated + tenantCredit + landlordCredit
+ tenantWithdrawn + landlordWithdrawn = fundedAmount
```

直接向 Escrow 地址额外转 token 不改变 `fundedAmount` 或上述业务会计，也不能被当作第二笔押金领取。

## 案件与材料规则

- CHECKOUT 案件只判断“是否提前启动押金结算”，不直接分配押金，也不判断现实居住权。
- CLAIMS 结果必须按争议项目的固定顺序完整覆盖；每项给 L 的金额不能超过该项，且满足 0.01 步长。
- R 提案在挑战期内不分配；T/L 任一方挑战时记录 `challengeCommitment`，随后原提案哈希与结果向量被清除，不能复活。
- R 超时从固定 `primaryDeadline` 起算 F；及时挑战从挑战交易时刻起算 F。
- F 只能在 `fallbackEvidence` 结束后、`fallbackDeadline` 之前作出结果。
- `recordEvidence(bundleId, version, commitment)` 以调用者作为 submitter，版本必须从 1 连续递增；历史版本保留。认可引用精确 submitter/bundleId/version/commitment，新版本不继承旧认可。

## 事件与索引

稳定发现入口：Registry 的 `ProfileCreated/ProfileAccepted/ProfileClosedToNewFunding`、Factory 的 `LeaseCreated`。Escrow 的核心事件包括：

- 入金/资金：`TermsAccepted`、`Funded`、`CreditAllocated`、`Withdrawn`；
- 交接：`CheckoutRequested`、`CheckoutResponded`、`CheckoutCaseOpened`、`CheckoutCaseResolved`；
- 申索：`ClaimsOpened`、`ClaimsSubmitted`、`ClaimResponded`、`ClaimWaived`、`ClaimsClosed`；
- 案件：`CaseOpened`、`DecisionProposed`、`CaseEscalated`、`DecisionFinalized`、`ServiceTimedOut`、`TimeoutAllocated`、`EscrowExpired`；
- 和解/材料：`SettlementProposed`、`SettlementConfirmed`、`EvidenceCommitted`、`EvidenceAcknowledged`。

D/E 以 `chainId + txHash + logIndex` 幂等消费并保存 blockHash；页面金额以链读和真实事件为准，不能用数据库按钮直接改成“已付款”。

## 构建与交接状态

固定命令：

```sh
npm run build:contracts
npm run test:contracts
npm run check:contract-sizes
```

当前本地结果为 32/32 通过，生产合约尺寸均低于 EIP-170；尚未绑定合并 commit、独立复核或测试网部署。ABI 交付时必须附源码 commit、solc/Forge 版本、chainId、部署地址/区块/交易、时间方案和 ABI digest。任何字段、权限、金额或期限变化都要同步 C/D/E，不能只改前端类型。
