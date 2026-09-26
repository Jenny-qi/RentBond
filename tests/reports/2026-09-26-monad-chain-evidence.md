# Monad Testnet 只读证据核验（2026-09-26）

范围：用户先前通过 Remix/MetaMask 手动进行的五份合约部署、一笔 `createLease`、一笔 `fund`。本次只读 RPC 查询，不使用钱包、不签名、不广播。原始人工记录在 `deployments/monad-testnet-2026-09-24.observed.json`，逐项复核后的结构化快照在 [`chain-evidence.json`](../../deployments/monad-testnet-2026-09-26.chain-evidence.json)。

## 固定构建及验收范围

- ABI 来源 commit：`ca4b36cf6ac85cd0f91e32f8ca107109dc8a54ac`；五份 ABI bundle SHA-256：`fd14c75103ccba1074df13fc4995c38ef3ebf7d00d2efb06cb926307f29629e1`。
- Monad Testnet chainId 为 `10143`。五份合约按三套固定 Solidity 0.8.24 编译配置，与链上**可执行 runtime** 比对：MockUSD optimizer 1 / no viaIR；ResolverRegistry optimizer 200 / no viaIR；其余 optimizer 1 / viaIR。构造函数 immutable 地址和 Solidity CBOR/IPFS 元数据不参加逐字节比较；指针值另由链上 getter 交叉验证。因此不能宣称完整字节码哈希等同或独立审计完成。
- 五个地址在所记部署块前无代码、部署块起有代码；四份顶层合约部署收据的 `contractAddress` 与地址相符。Escrow 是 Factory 调用 Deployer 在 `createLease` 内部创建，其创建交易由两条创建事件和当前代码/条款交叉印证。
- `LeaseCreated`、`EscrowDeployed`、`Funded` 和 MockUSD `Transfer` 相互匹配；金额 `1,000,000,000` base units = 1,000 MockUSD（6 位小数）。Factory 指向既定 Registry/Deployer，Escrow 指向 Factory；Registry 的同一方案记录了主备处理人均已接受。
- 快照读取时，Escrow `phase=2`（Active）、`tenantAccepted=true`、`funded=1,000,000,000`、`unallocated=1,000,000,000`、双方 credit/withdrawn 均为零、合约代币余额 `1,000,000,000`。状态是**读取块时的快照**，之后可能改变。源代码和运行状态不能单独证明 UI、API 或账户恢复可用。

## 可重复命令与真实结果

按 [`deployments/README.md`](../../deployments/README.md) 编译三组 profile 后运行：

```sh
RENTBOND_READONLY_RPC_URL=https://testnet-rpc.monad.xyz \
  node scripts/attest-monad-deployment.mjs \
  deployments/monad-testnet-2026-09-24.observed.json \
  deployments/monad-testnet-2026-09-26.chain-evidence.json
node --test scripts/attest-monad-deployment.test.mjs
```

链上只读脚本于 2026-09-26 返回成功；其输出保存在上面的 JSON，包含读取区块、五份部署收据与代码摘要、两笔业务回执、条款、服务方案及会计余额。元数据掩码/篡改拒绝单测 3/3 通过，原基础核验模拟 RPC 5/5 通过；`npm run test:contracts` 当次 40/40 通过。构建和本地测试不能替代链上结算行为验收。

## 尚未通过的验收

- TS01：未由四个真实钱包分别执行错误链、拒签和越权交易；读取到 T/L/R/F 四个互异地址不等于操作验收。
- TS02：链上只验证一次创建和精确入金；第二次入金拒绝、申索、700/100/200 分配、领取和余额闭环无交易证据。
- 这份实际租约的 `leaseEndAt` 为 **2026-12-31 00:00 UTC**、`hardEndAt` 为 **2027-02-06 00:00 UTC**；即使 T/L 提前共同确认退租，正常配置的申索窗口仍为七天。不能靠只读查询或更改本地时钟让公共测试网立即完成结算。剩余真实交易由相应钱包本人审阅并签署，不应由脚本代签。
- BL06：必须由另一位具备合约资金测试能力的成员审阅代码、来源/编译配置和回执，留下签名或 PR review。
- Web/API/Worker 集成、事件重放、身份恢复、真实用户流程仍无完成证据。

这些缺项完成前，不应把快照变成 `readyForFrontend: true` 的发布清单，也不应将 AT/TS 标记为 Passed/Verified。
