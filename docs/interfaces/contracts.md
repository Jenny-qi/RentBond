# 合约 ABI 与事件交接

B 负责实现。当前已加入 `ResolverRegistry`、`DepositEscrow`、`LeaseFactory` 源码和消费者接口；MockUSD、部署和最终 ABI 仍按阶段交付。PRD 11.4/11.7 是完整语义接口；下表便于分工，不能作为删减列表。

| 模块 | 主要接口组 | 消费者 |
| --- | --- | --- |
| MockUSD | ERC-20，6 位精度，受限测试铸币 | C 入金、B/E 试验 |
| Registry | createProfile / acceptProfile / revokeForNewFunding / isEligible | C/D 服务方案，Factory/fund 校验 |
| Factory | createLease / pauseNewLeases | C 创建，E 租约发现 |
| Escrow 入金 | acceptTerms / cancelUnfunded / expireUnfunded / fund | C |
| 材料 | recordEvidence / acknowledgeEvidence | C/D |
| 交接 | requestCheckout / respondCheckout / openCheckoutCase / startScheduledSettlement | C/E |
| 申索 | submitClaims / respondClaim / waiveClaim / closeClaims / openClaimCase | C/E |
| 案件 | proposeDecision / challenge / escalateTimeout / finalizePrimary / resolveFallback / markServiceTimeout | C/E |
| 和解 | proposeSettlement / confirmSettlement | C |
| 退出与领取 | finalizeTimeout / expireEscrow / withdraw / withdrawFor | C/E/独立恢复工具 |

交付 ABI 必须从当前构建生成，并附源码 commit、编译器/库/工具版本、错误码、事件字段、部署网络/区块及地址。事件支持按 chainId+txHash+logIndex 幂等消费，保存 blockHash。部署记录模板在 deployments。

资金变更只来自真实事件/链读取。主结果不立即分配，挑战后原主结果不可复活；结果向量覆盖完整案件快照且每项不超上限。最终期限先尊重有效权利再退剩余，公开调用不能修改受益人。

接口封装可适应 Solidity 类型，但改变权限/金额/期限需要 ADR；所有消费者同步 ABI。错误至少包含错误角色/状态/截止、金额非法、StaleProposal、ServiceNotAccepted/ServiceRevoked/OutsideServiceScope 等 PRD 语义，具体 ABI 冻结时填写精确名称。

## Registry 当前冻结接口

实现文件：`contracts/src/ResolverRegistry.sol`。

消费者接口：`contracts/src/interfaces/IResolverRegistry.sol`。

`ServiceProfile` 字段为：`profileId`、`serviceTermsHash`、`ruleVersion`、`primaryResolver`、`fallbackResolver`、`token`、`maxDeposit`、`maxLeaseEnd`、`acceptUntil`、`timingProfileId`。

规则：任何地址可提交唯一草稿；内容创建后不可修改；R/F 都接受同一方案后才可用；R 或 F 任意一方可关闭整个方案的新租约和新入金；已创建但未入金租约在撤销后不能继续 fund；已入金租约不受撤销影响。

`isEligible(profileId, terms)` 返回 `bool`，其中 `terms` 包含 token、depositAmount、leaseEndAt、ruleVersion、timingProfileId 和 serviceTermsHash；函数检查接受状态、撤销状态、服务有效期、资产、规则、条款哈希、押金上限和租期上限。

Registry 的事件为 `ProfileCreated`、`ProfileAccepted`、`ProfileClosedToNewFunding`；事件的稳定主键为 `profileId`，R/F 地址作为 indexed 角色字段。该 ABI 仍需在 Foundry 构建后由实际产物确认。

`DepositEscrow` 当前已实现 `acceptTerms`、`cancelUnfunded`、`expireUnfunded`、`fund`、材料/交接接口、`startScheduledSettlement`、`submitClaims`、`respondClaim`、`waiveClaim`、`closeClaims`、`openClaimCase`、Primary/Fallback 案件接口、双方和解、`finalizeTimeout`、`expireEscrow`、`withdraw`、`withdrawFor` 及基础会计/view。`fund` 在转账前后检查实际 token 余额增量，并在入金时重新查询 Registry；MockUSD、部署和 Foundry 实跑记录仍待后续阶段。

`LeaseFactory` 当前已实现 `createLease` 和 `pauseNewLeases`。租约发现使用 `LeaseCreated` 事件（稳定主键为 `leaseId`/`escrow`），以控制 Factory 部署字节码大小；Factory 以 Registry 为服务字段唯一来源，把 R/F、Token、规则和期限快照传入新 Escrow；暂停只阻止新建。
