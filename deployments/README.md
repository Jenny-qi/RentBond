# 部署记录

负责人 B，E 验证。`example.json` 的 null 不是真实地址；未完成下述核验前，正式记录的 `readyForFrontend` 必须保持 `false`。

`monad-testnet-2026-09-24.observed.json` 仅保存用户提供的 Remix/钱包观察值（四个核心合约、一份租约合约、两笔交易）。它不是可供前端直接使用的部署清单，也不证明源码版本、ABI、事件语义或押金的当前状态。请保留可能出现的核验失败，并回查原始交易和地址；不要静默改写记录使检查通过。

只读核验（不连接钱包、不广播交易）：

```sh
RENTBOND_READONLY_RPC_URL=https://testnet-rpc.monad.xyz \
  node scripts/verify-monad-evidence.mjs deployments/monad-testnet-2026-09-24.observed.json
node --test scripts/verify-monad-evidence.test.mjs
```

第一条命令要求可访问 Monad Testnet RPC；它确认 chainId、所列地址目前有字节码，以及所列交易收据成功且发送方/接收方匹配。若 RPC 无法连接，结果仍是未核验。其通过也**不能**代替固定源码/ABI 的字节码比对、事件解码、条款/期限核对、链上阶段及余额读数或独立评审。

真实记录按网络及版本保存 chainId、MockUSD/Registry/EscrowDeployer/Factory 地址、部署块、txHash、源码 commit、ABI hash、timeoutPolicy、完整时间配置、serviceProfileId 和迁移版本。不可包含凭据。DEMO_SHORT 与正常 37 天配置分开记录；地址必须和 Factory/Registry 链上读取值交叉核验。

只有同时满足以下条件，网络记录才可设置 `readyForFrontend: true`：

- RPC 实际返回预期 chainId，四个核心地址均为非零且链上存在字节码；
- 部署交易、区块号、部署时间和源码 commit 可复核；
- Factory 指向记录中的 Registry 与 EscrowDeployer；
- ABI 来自 `npm run contracts:export:abi`，记录的 digest 与 `abi/manifest.json` 一致；
- 正常时间方案、timeoutPolicy 和 R/F 各自接受记录已经核对。

`abi/` 只证明接口来自固定构建，不证明任何地址已经部署。
