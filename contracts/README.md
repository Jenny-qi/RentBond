# 合约工程

负责人 B。当前分支已实现可运行的 Solidity/Foundry 合约；一次手工部署和入金已有[只读测试网证据](../tests/reports/2026-09-26-monad-chain-evidence.md)。尚无完整测试网结算/领取或独立安全审查。

## 当前实现

| 合约 | 作用 |
| --- | --- |
| `MockUSD` | 6 位小数、受限铸币的无现金价值测试资产 |
| `ResolverRegistry` | 保存不可变服务方案；R/F 对同一方案分别预授权；任一方可停止其用于新租约/新入金 |
| `LeaseFactory` | 从 Registry 复制服务快照并创建每租约独立 Escrow |
| `DepositEscrowDeployer` | 将 Escrow 创建字节码与 Factory 分离，避免 Factory 超过 EVM 大小限制；无 owner 或提款权限 |
| `DepositEscrow` | 条款接受、精确入金、交接、申索、部分分配、主备处理、和解、超时退出及固定受益人领取 |

关键规则：单 T/L、T/L/R/F 地址互异、固定 MockUSD、1—10,000 MockUSD、最小业务单位 0.01、最多 10 项申索、每租约不可升级、无管理员提款。`hardEndAt` 由服务方案的完整时间配置推导，不能由房东自行填写。默认正常配置为租约到期后最迟 37 天退出。

## 本地验证

从仓库根目录运行：

```sh
npm run build:contracts
npm run test:contracts
npm run check:contract-sizes
```

或在 `contracts/` 内运行固定工具版本：

```sh
npx --yes @foundry-rs/forge@1.7.1 build
npx --yes @foundry-rs/forge@1.7.1 test -vv
npx --yes @foundry-rs/forge@1.7.1 build --sizes --skip test --skip script
```

本地最后一次结果为 40/40 测试通过。除 700/100/200、CHECKOUT 主备流程、证据版本、服务撤销、挑战、超时、旧和解失效、固定收款人及 hardEnd 外，现有独立测试也覆盖 MockUSD 铸币/授权语义与 T/L/R/F/无关地址的关键越权路径；这不是测试网验收或安全审计。

生产合约的本地优化后 runtime 均低于 24,576-byte EIP-170 限制，其中最接近上限的是 `DepositEscrowDeployer`。配置固定 Solidity 0.8.24、optimizer runs 1、via-IR 和 OpenZeppelin ReentrancyGuard 5.0.2。

部署流程见 [script/README.md](script/README.md)。固定构建 ABI 可用 `npm run contracts:export:abi` 重新生成并以 `deployments/abi/manifest.json` 校验。真实部署前仍必须完成外部复核、账户与测试 MON 准备、链上部署记录，以及剩余边界/fuzz/invariant 测试。
