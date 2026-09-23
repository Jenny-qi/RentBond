# 合约部署脚本

负责人 B，E 复核。脚本不保存私钥；使用 Forge 已配置的钱包/keystore。每个脚本先把链上 `block.chainid` 与环境变量 `CHAIN_ID` 比较，不匹配即停止，不会回退到其他网络。

## 顺序

1. `DeployCore.s.sol` 部署 MockUSD、Registry、EscrowDeployer 和 Factory。
2. `CreateServiceProfile.s.sol` 创建默认 37 天时间方案草稿。
3. `AcceptServiceProfile.s.sol` 分别由 R 和 F 各运行一次；不是平台替两人签名。
4. 核对链、地址、交易、字节码和 Profile 内容后写入 `deployments/<network>.json`。

## Monad Testnet 安全入口

先按 `.env.example` 提供非秘密配置。部署器只接受 `RENTBOND_DEPLOYMENT_NETWORK=monad-testnet`、`CHAIN_ID=10143`、显式 RPC 和非零 `MOCK_USD_MINT_OPERATOR`，并实时调用 `eth_chainId` 复核；不会读取 raw private key。

```sh
npm run contracts:preflight:testnet
```

这个命令只读，不签名、不广播。真实广播还要求本机已配置的 Forge keystore 账户，并须显式设置：

```sh
export DEPLOYER_ACCOUNT=<deployer-keystore-name>
export RENTBOND_BROADCAST_CONFIRMATION=MONAD_TESTNET_ONLY
npm run contracts:deploy:testnet
```

脚本会拒绝未提交的生产合约、Solidity 部署脚本或 Foundry 配置。不要把密码、助记词、私钥或 keystore 文件提交到仓库。

核心部署完成后，再由 Profile 创建者以及 R/F 各自的 keystore 运行：

```sh
npx --yes @foundry-rs/forge@1.7.1 script --root contracts script/CreateServiceProfile.s.sol:CreateServiceProfile \
  --rpc-url "$RPC_URL" --account <profile-creator-keystore> --broadcast

npx --yes @foundry-rs/forge@1.7.1 script --root contracts script/AcceptServiceProfile.s.sol:AcceptServiceProfile \
  --rpc-url "$RPC_URL" --account <resolver-keystore> --broadcast
```

`CreateServiceProfile` 使用 7/7/7/3/7/3/2/7/3 天配置：最后七项相加使正常 `hardEndAt = leaseEndAt + 37 days`；`fallbackEvidence=2 days` 包含在 7 天 F 总窗口内。

当前脚本已编译，但尚未广播到本地链或 Monad 测试网。禁止在没有真实交易证据时填写部署地址或标记部署成功。

ABI 不从手写接口复制。运行 `npm run contracts:export:abi` 会从固定 Foundry artifacts 导出五份 ABI，并生成包含每份文件及整包 SHA-256 的 `deployments/abi/manifest.json`。
