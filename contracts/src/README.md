# 合约源码

负责人 B。源码按以下边界拆分：

- `MockUSD.sol`：6 位小数测试资产；只有构造时固定的 `mintOperator` 可铸币。
- `ResolverRegistry.sol`：不可变 `ServiceProfile`、确定性 profile ID、R/F 双方预授权与关闭新入金。
- `RentBondRules.sol`：金额范围、0.01 MockUSD 步长、固定超时政策、时间配置哈希与 `hardEndAt` 推导。
- `LeaseFactory.sol`：以 Registry 为服务字段唯一来源；只有参数中的 L 能创建；暂停只影响新租约。
- `DepositEscrowDeployer.sol`：无状态部署器，仅用于隔离 Escrow 创建字节码。
- `DepositEscrow.sol`：每租约状态机及资金会计。
- `interfaces/`：Registry、部署器和最小 ERC-20 消费接口。

Registry 不设置 `profileOwner`，也没有修改方案内容的入口。R/F 接受的是包括实际时间配置和 timeoutPolicy 在内的确定性哈希；已入金租约继续使用本地快照，后续关闭服务方案只阻止新租约/新入金。

Escrow 不可升级，固定 T/L/R/F、资产和受益人，无 `ownerWithdraw` 或任意外部执行。Token 调用兼容标准布尔返回和无返回 ERC-20，并以入金前后余额差拒绝转账税/少到账资产。
