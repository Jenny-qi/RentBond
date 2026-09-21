# 合约工程

负责人 B。目标 Foundry + Solidity + 固定版本 OpenZeppelin。当前已加入 `ResolverRegistry`、`DepositEscrow`（入金、材料、交接、申索、Primary/Fallback、和解、hardEnd）和 `LeaseFactory` 及对应最小测试；MockUSD、部署脚本和 Foundry 实跑记录仍在后续阶段实现。

src/ 实现四类合约；test/ 覆盖权限/边界/fuzz/invariant；script/ 部署并生成记录。版本与 Monad 配置先在 RB-03 验证再固定。

先通过最小资金试验，再实现 Registry/Factory/正式状态机。不得为了演示跳过 F、hardEndAt 或资金守恒。

本地合约目录使用 `foundry.toml`，配置 Solidity 0.8.24、optimizer、OpenZeppelin 5.0.2 remapping 和 `src/`、`test/`、`script/` 路径。当前环境已用 solc 0.8.24 编译 Registry 源码和测试源码；Foundry 运行结果待在具备 `forge` 的开发环境中记录。
