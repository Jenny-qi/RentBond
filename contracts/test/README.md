# 合约测试

负责人 B，E 需独立复核。当前有 40 个可运行单元/流程测试，分布于：

- `ResolverRegistry.t.sol`：确定性方案、双处理人接受、服务范围、撤销、时间与退出政策绑定；
- `LeaseFactory.t.sol`：快照复制、角色隔离、金额精度、暂停和部署器来源；
- `DepositEscrow.t.sol`：精确入金、700/100/200、CHECKOUT、CLAIMS、主结果、挑战、F、退出、材料版本、和解、hardEnd、公开代付领取和额外 token 转入；
- `DepositEscrowAuthorization.t.sol`：T/L/R/F 固定权限、无关地址越权失败、主备处理边界与共同和解确认；
- `MockUSD.t.sol`：元数据、受限铸币、零地址、有限/无限 allowance 与总供应量守恒；
- `TestHelpers.sol`：独立 T/L/R/F 调用者与统一短时测试配置。

运行：

```sh
npm run test:contracts
```

本地结果是 40 passed / 0 failed。该结果尚未绑定已推送 commit，也未替代 Monad 测试网交易、E 的独立复核或完整 AT 验收。

仍需补充：每个 deadline 的系统性 -1/0/+1、fuzz/invariant、恶意回调/异常 ERC-20、事件序列、gas 基线，以及全新 clone 和测试网复现。
