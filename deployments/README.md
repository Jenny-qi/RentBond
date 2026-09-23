# 部署记录

负责人 B，E 验证。当前没有部署；`example.json` 的 null 不是真实地址，`readyForFrontend` 必须保持 `false`。

真实记录按网络及版本保存 chainId、MockUSD/Registry/EscrowDeployer/Factory 地址、部署块、txHash、源码 commit、ABI hash、timeoutPolicy、完整时间配置、serviceProfileId 和迁移版本。不可包含凭据。DEMO_SHORT 与正常 37 天配置分开记录；地址必须和 Factory/Registry 链上读取值交叉核验。

只有同时满足以下条件，网络记录才可设置 `readyForFrontend: true`：

- RPC 实际返回预期 chainId，四个核心地址均为非零且链上存在字节码；
- 部署交易、区块号、部署时间和源码 commit 可复核；
- Factory 指向记录中的 Registry 与 EscrowDeployer；
- ABI 来自 `npm run contracts:export:abi`，记录的 digest 与 `abi/manifest.json` 一致；
- 正常时间方案、timeoutPolicy 和 R/F 各自接受记录已经核对。

`abi/` 只证明接口来自固定构建，不证明任何地址已经部署。
