# 合约 ABI 与事件交接

B 负责实现，当前没有 Solidity 业务代码、ABI 或部署。PRD 11.4/11.7 是完整语义接口；下表便于分工，不能作为删减列表。

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
