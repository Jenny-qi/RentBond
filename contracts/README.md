# 合约工程

负责人 B。目标 Foundry + Solidity + 固定版本 OpenZeppelin。当前未提供可编译或可部署的合约。

src/ 实现四类合约；test/ 覆盖权限/边界/fuzz/invariant；script/ 部署并生成记录。版本与 Monad 配置先在 RB-03 验证再固定。

先通过最小资金试验，再实现 Registry/Factory/正式状态机。不得为了演示跳过 F、hardEndAt 或资金守恒。

