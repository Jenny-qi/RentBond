# 合约源代码计划

负责人 B：MockUSD.sol、ResolverRegistry.sol、LeaseFactory.sol、DepositEscrow.sol。

每租约不可升级；固定 T/L/R/F 与资产；无 ownerWithdraw/任意执行；最多10项；入金前校验服务有效，入金后快照不变。

