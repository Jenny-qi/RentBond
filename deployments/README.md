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

2026-09-26 在官方 RPC 上找到了五个合约首次出现字节码的区块和对应交易，见 `monad-testnet-2026-09-26.deployment-txs.json`。`monad-testnet-2026-09-26.chain-evidence.json` 是更完整的**只读证据快照**，不是可发布的正式部署清单。重新生成时，先执行固定构建（需要 Node 24.x 和 `@foundry-rs/forge@1.7.1`）：

```sh
npm run build:contracts
FOUNDRY_VIA_IR=false FOUNDRY_OUT=out-noir FOUNDRY_CACHE_PATH=cache-noir \
  npx --yes @foundry-rs/forge@1.7.1 build --root contracts --skip test --skip script --silent
FOUNDRY_VIA_IR=false FOUNDRY_OPTIMIZER_RUNS=200 FOUNDRY_OUT=out-noir200 FOUNDRY_CACHE_PATH=cache-noir200 \
  npx --yes @foundry-rs/forge@1.7.1 build --root contracts --skip test --skip script --silent
RENTBOND_READONLY_RPC_URL=https://testnet-rpc.monad.xyz \
  node scripts/attest-monad-deployment.mjs \
  deployments/monad-testnet-2026-09-24.observed.json \
  deployments/monad-testnet-2026-09-26.chain-evidence.json
node --test scripts/attest-monad-deployment.test.mjs
```

快照逐一验证部署块前无代码、部署块有代码、成功回执、当前运行时代码的可执行部分、`LeaseCreated` / `EscrowDeployed` / `Funded` / `Transfer` 事件、Factory 指针、Registry 授权、条款、资金守恒和余额。源码/ABI 锚定 `abi/manifest.json` 的 commit 和摘要；对比排除构造函数 immutable 数据及 Solidity 的 CBOR/IPFS 内容哈希，**不宣称链上字节码与仓库 artifact 完整逐字节相同**。MockUSD 使用 optimizer 1 / viaIR false，Registry 使用 optimizer 200 / viaIR false，其余使用 optimizer 1 / viaIR true；这些是逐份本地重新编译并与链上可执行代码比对所得，不应据此猜测 Remix 的其他设置。

当前一份租约成功入金 1,000 MockUSD，仍是 Active，全部 1,000 未分配；**尚没有 700/100/200 测试网结算或领取证据**。这份证据不替代四账户拒签/越权、完整 TS01/TS02、第二人复核、安全审查及 Web/API/Worker 验收。`readyForFrontend` 暂不置真。

真实记录按网络及版本保存 chainId、MockUSD/Registry/EscrowDeployer/Factory 地址、部署块、txHash、源码 commit、ABI hash、timeoutPolicy、完整时间配置、serviceProfileId 和迁移版本。不可包含凭据。DEMO_SHORT 与正常 37 天配置分开记录；地址必须和 Factory/Registry 链上读取值交叉核验。

只有同时满足以下条件，网络记录才可设置 `readyForFrontend: true`：

- RPC 实际返回预期 chainId，四个核心地址均为非零且链上存在字节码；
- 部署交易、区块号、部署时间和源码 commit 可复核；
- Factory 指向记录中的 Registry 与 EscrowDeployer；
- ABI 来自 `npm run contracts:export:abi`，记录的 digest 与 `abi/manifest.json` 一致；
- 正常时间方案、timeoutPolicy 和 R/F 各自接受记录已经核对。

`abi/` 只证明接口来自固定构建，不证明任何地址已经部署。

## DEMO_SHORT 候选（尚未部署）

`contracts/script/CreateDemoShortProfile.s.sol` 定义单独的短时服务方案：交接回应 5 分钟，申索/租客回应各 10 分钟，证据/主处理/挑战/备用处理/退出通知分别为 5/10/5/15/5 分钟，备用证据窗口 5 分钟；`hardEndAt = leaseEndAt + 60 分钟`。在合约真正创建并由 R/F 各自确认前，`demo-short.example.json` 只能作模板，所有地址、区块、交易、profileId 和 ABI digest 保持 null。正常配置和已有 2026-12-31 到期租约不变。

创建前须为本方案使用独立的 `DEMO_SHORT_SERVICE_TERMS_HASH`，明确向参与者显示 `DEMO_SHORT`、UTC 截止时间与 1,000 MockUSD 的测试资产属性；确认 `leaseEndAt` 留有足够时间供 T/L 本人完成条款和入金。R/F 分别对新 profileId 调用 `acceptProfile`；再由 L 创建租约、T 接受/授权/入金。逐笔保存回执、区块、来源 commit、固定构建 ABI 和角色地址后，用只读脚本复核并生成实际记录。任何人不得在脚本中代签 T/L/R/F 的交易，也不得把模板改名当成链上证据。

700/100/200 需要 L 提交 100 与 200 的两项申索、T 接受 100 并争议 200，等待申索窗口截止执行 `closeClaims` 后才能显示 700/100 可领取；处理 200 中 50 归 L 后最终为 850/150。另一份独立租约测试 R/F 超时退出的 900/100，不能拿前一份已结算租约重复演示。合约常量 `CHECKOUT_RETRY_DELAY = 1 day`，短时方案并未缩短失败交接请求的重试间隔；这条异常路径仍须单独验收。
