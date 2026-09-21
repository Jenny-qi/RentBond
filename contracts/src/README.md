# 合约源代码计划

负责人 B：MockUSD.sol、ResolverRegistry.sol、LeaseFactory.sol、DepositEscrow.sol。

当前已实现：

- `ResolverRegistry.sol`：不可变 ServiceProfile、R/F 接受、R/F 任一方关闭新建与新入金、服务范围查询；
- `interfaces/IResolverRegistry.sol`：Factory、Escrow 和其他消费者使用的稳定接口。
- `DepositEscrow.sol`：租约快照、租客条款接受、精确入金、材料/交接、申索窗口、700/100/200 部分分配、Primary/Fallback、双方和解、hardEnd 兜底、基础会计和固定 T/L 领取入口。
- `LeaseFactory.sol`：从 Registry 读取服务快照、仅允许 L 创建、部署独立 Escrow、生成 leaseId、暂停新建。
- `interfaces/IERC20Minimal.sol`：当前最小资金闭环使用的 ERC-20 接口；重入保护固定使用仓库内 OpenZeppelin Contracts 5.0.2。

当前 Registry 不设置 `profileOwner`，不提供修改 Profile 内容的函数。已入金租约必须使用自己的服务快照。

每租约不可升级；固定 T/L/R/F 与资产；无 ownerWithdraw/任意执行；最多10项；入金前校验服务有效，入金后快照不变。
