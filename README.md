# RentBond — Programmable Rental Deposit Settlement

> **Dispute 200, not your entire 1,000 deposit.**

RentBond 是面向跨境租客与小型房东的租房押金结算应用。房东逐项提出扣款，租客逐项接受或争议；申索窗口结束后，无争议款项可以先分配、领取，让局部争议不再拖住整笔押金。

[在线体验](https://rentbond.vercel.app/) · [公开结算演示](https://rentbond.vercel.app/demo) · [Mera 链上操作证据](#mera-账户与真实链上操作) · [本地运行](#本地运行)

**赛道：Consumer Products & Payments**

**拟申报赞助商奖项：Best Mera-Powered UX on Monad — Monad Foundation**

**网络：Monad Testnet（chainId 10143）。MockUSD 和 test MON 均为测试资产，无现金价值。**

## 为什么做 RentBond

作为中外合作大学的学生，我们也可能在未来独自去到一个陌生的国家。租房往往是抵达后要面对的第一道难题，而一笔押金可能是几个月的生活费，是家人的支持，也是异国生活里的一份安全感。

**如果只有一部分扣款存在争议，为什么要让整笔押金都陷入等待？**

RentBond 希望用清楚的条款、逐项回应和可核查的资金记录，让租客与房东都知道：钱在哪里、下一步谁来操作、什么时候可以领取。勇敢走向世界的人，值得被这个世界温柔以待。

## 已完成的产品能力

| 能力 | 用户可以做什么 |
| --- | --- |
| Mera / Passkey 账户 | 创建账户或使用已有通行密钥登录，用同一账户确认并签署链上操作 |
| 租约与邀请 | 房东建立草稿、邀请指定租客，双方查看条款，由房东部署合约、租客确认 |
| 押金存入 | 分别确认条款、精确授权 MockUSD、存入约定金额，查看链上确认结果 |
| 逐项扣款与争议 | 房东提交扣款清单，租客逐项接受或争议，查看无争议金额与待处理金额 |
| 结算与领取 | 按合约期限分配款项，由固定受益人领取；支持主备处理期限和最终超时退出 |
| 私有材料与导出 | 按租约和案件权限上传、扫描、查看版本与导出资料 |
| 事件同步与历史 | 将链上事件同步到工作区，显示交易记录和已确认余额 |

账户、租约、材料与资金流程已接入真实 API 和合约。以下分别列出已经完成的公网操作和自动化验证范围。

## 已完成的 Monad 测试网演示

| 演示 | 已确认结果 | 证据 |
| --- | --- | --- |
| Mera 租客入金 | 同一 Mera 账户完成接受条款、授权和存入 1,000 MockUSD | [三笔交易及验证记录](tests/reports/2026-10-13-mera-testnet-funding.md) |
| 团队钱包全额退款 | 租客领取 1,000 MockUSD，未分配及待领取余额归零 | [公开演示与交易记录](https://rentbond.vercel.app/demo) |
| 团队钱包部分争议、超时退出 | 接受 100、争议 200；无争议款项先领取，超时退出后累计租客领取 900、房东领取 100，余额归零 | [公开结算快照](https://rentbond.vercel.app/demo/settlement-snapshot.json) |

后两项是团队钱包完成的结算演示，与 Mera 入金演示分开取证。900/100 的结果来自主备服务超时退出，不是人工裁决结果。公开演示页提供历史证据，不提供共享钱包或接管既有租约的权限。

## Mera 账户与真实链上操作

Mera 构成 RentBond 的用户账户和客户端签名层。用户在支持 WebAuthn PRF 的设备上，通过系统 Passkey 验证创建或重新进入账户，无需为这条账户路径安装钱包扩展或抄写助记词。账户签署 SIWE 登录消息后，网站按该地址授予租约与材料访问权限。

每笔资金操作仍需用户在页面明确确认；登录不等于同意扣款或付款。签名会话保存在客户端内存中，有效期为 15 分钟，退出或到期后需要重新验证。使用已有通行密钥会按固定域名与派生规则恢复账户；跨设备同址恢复仍待真机验证，也不承诺丢失全部凭证后的恢复。

在 Monad Testnet 上，租客账户 `0x2E7547C21254b0F4457fef91Ceec847c43cD29dF` 已完成以下操作，三笔交易回执均为成功：

| 操作 | 链上交易 |
| --- | --- |
| 接受完整条款 | [acceptTerms](https://testnet.monadexplorer.com/tx/0x397f9b109baaa3527bce1b9c97b06f860ba6fa5e8f82a2aabb29bf10abaee855) |
| 精确授权 1,000 MockUSD | [approve](https://testnet.monadexplorer.com/tx/0x481402ab781bc08e68ca5a17981f679b0f46be3b6b2c408adab33e426ca31a51) |
| 存入 1,000 MockUSD | [fund](https://testnet.monadexplorer.com/tx/0x0a495f9f622d84c7e1c1f24698419f040f51d6ff6463463576e085a32a18b3a8) |

对应 [V2 租约](https://rentbond.vercel.app/leases/3308e820-c577-4041-9797-c7f837b732d0)仅限参与者登录查看；第三方可直接查看公开交易证据。授权和入金是两笔独立交易，只有成功入金后才显示 Funded。

实现入口：[Passkey 账户](apps/web/src/features/live/wallet.ts) · [登录与交易确认](apps/web/src/features/live/LiveProvider.tsx) · [合约交互](apps/web/src/features/live/client.ts)。

## 押金如何结算

以 1,000 MockUSD 押金为例：房东申报清洁费 100、损坏费 200，租客接受 100、争议 200。在申索窗口结束并完成链上分配后：

| 金额 | 去向 |
| ---: | --- |
| 700 MockUSD | 租客可领取 |
| 100 MockUSD | 房东可领取 |
| 200 MockUSD | 等待争议处理 |

如果争议款中最终裁决 150 给租客、50 给房东，累计分配为 **850/150**，各自领取后才算到账。该裁决路径已通过本地自动化测试，公网人工裁决仍待实测。

如果主备服务均未在期限内处理，则按双方事先确认的超时规则退出。团队已在测试网上完成 **900/100** 的超时退出与领取。

**预计金额、可领取金额和已领取金额分别展示。** 合约执行约定的权限、期限和金额规则，不判断材料真伪，也不保证裁决公正。

## 评委如何体验

1. 无需登录，可先打开[公开演示页](https://rentbond.vercel.app/demo)，查看已经完成的结算结果及交易记录。
2. 需要实际操作时，在[登录页](https://rentbond.vercel.app/login)创建自己的 Passkey 账户，或使用已有通行密钥登录。
3. 将公开账户地址提供给项目团队，通过赛事提交页的团队联系方式协调有效租约邀请和 MockUSD 发放。MockUSD 是项目测试代币，不能从 Monad 官方 Faucet 领取。
4. test MON 用于手续费，可通过 [Monad Faucet](https://faucet.monad.xyz/)申请。团队协助房东等其他角色，评委本人确认租客端交易。

既有演示租约的参与地址已经固定；新的体验者需要新的有效邀请或租约。当前公开演示不能保证自动补给 Gas，已完成的 Mera 操作使用了账户中预先准备的 test MON。

## 技术架构

| 层 | 实现 |
| --- | --- |
| 前端与 API | Next.js 15、React 19、TypeScript |
| 账户与签名 | Mera 0.2.0、WebAuthn Passkey/PRF、SIWE、viem 2.56.9 |
| 押金合约 | Solidity 0.8.24、Foundry、OpenZeppelin |
| 数据与私有材料 | PostgreSQL；本地 PGlite；按租约授权的私有存储、ClamAV 扫描与隔离 |
| 后台任务 | 独立 Node.js Worker、事件同步、任务持久化与回滚处理 |
| 部署 | Vercel 前端、Azure 后端与 Worker、Monad Testnet 合约 |
| 验证 | Node.js 测试、Foundry 合约测试、Playwright 浏览器测试 |

Monad 提供 EVM 兼容的合约执行环境，租约接受、押金存入、扣款回应和领取均可通过公开回执核查。私有租约正文和材料保留在访问受控的链下存储中。

### 当前演示合约

| 合约 | Monad Testnet 地址 |
| --- | --- |
| MockUSD | `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` |
| ResolverRegistry | `0x61f13f0c0DAaC2802EeD3Cd4DD9FD67c93d0ce30` |
| LeaseFactory | `0x6ed49Bf8EE5E9ba2cbE2977fe100342Fe2999a7E` |
| Mera V2 DepositEscrow | `0x352d1eb19ebb706ea4fe008358f395666a68987e` |

历史部署资料见 [deployments](deployments/README.md)，Mera V2 演示以[对应验证记录](tests/reports/2026-10-13-mera-testnet-funding.md)中的地址、交易和区块为准。

## 测试与验证

代码基线 `f656e74` 的 [CI](https://github.com/Jenny-qi/RentBond/actions/runs/38344423260) 和 [Scaffold checks](https://github.com/Jenny-qi/RentBond/actions/runs/38344423487) 全部通过：

| 测试范围 | 结果 |
| --- | --- |
| Web / 后端 | 92 项通过，0 失败、0 跳过 |
| 合约 | 41 项通过，0 失败、0 跳过 |
| 跨模块集成 | IT-01 至 IT-09 全部通过 |
| 浏览器端到端 | E2E-01 至 E2E-08 全部通过 |
| 环境、类型与文档完整性 | 全部通过 |

本地浏览器测试覆盖邀请、接受条款、授权、入金、逐项争议、850/150 裁决结算、900/100 超时退出、取消、拒签和重复领取保护。其测试钱包与本地链不替代真实 Passkey、跨设备或公网验收；公网已完成范围见上方交易证据。

### 当前范围

项目是使用无现金价值资产的测试网原型，双方须在入金前同意使用，不能追回此前已经付给房东的押金。Mera 账户的完整结算与提现、跨设备同址恢复、公网主备裁决者实际裁决和独立资金审查仍待完成。Mera 专项演示视频及公开 HTTPS 视频链接正在整理，尚未作为最终材料发布。

## 本地运行

需要 Node.js 24.x、pnpm 12.8.1 和 Git。完整版本以 [package.json](package.json) 和 [pnpm-lock.yaml](pnpm-lock.yaml) 为准。

```sh
git clone https://github.com/Jenny-qi/RentBond.git
cd RentBond
pnpm install --frozen-lockfile --allow-build=esbuild --allow-build=core-js
npm run backend:abi --prefix apps/web
npm run backend:init --prefix apps/web
npm run db:migrate --prefix apps/web
npm run backend:seed --prefix apps/web
npm run dev --prefix apps/web
```

打开 `http://localhost:3000`。初始化会生成本地配置；链上操作还需要匹配的 RPC、网络、Factory 和有效服务方案。种子数据创建的是测试草稿，不会模拟已存入押金。环境配置见 [Web README](apps/web/README.md) 和[后端运行说明](apps/web/src/server/README.md)。

运行测试：

```sh
pnpm --filter @rentbond/web run test
pnpm --filter @rentbond/web run typecheck
npm run test:contracts
pnpm --filter @rentbond/web exec playwright install --with-deps chromium
node tests/runner.mjs integration
node tests/runner.mjs e2e
```

端到端测试会启动临时本地链、数据库和页面，无需真实账户或测试网资产。详细前置条件、测试替身与验证范围见 [tests/README.md](tests/README.md)。

## 项目结构与文档

| 路径 | 内容 |
| --- | --- |
| [apps/web](apps/web/README.md) | 页面、Mera 账户、后端 API 与私有材料 |
| [apps/worker](apps/worker/README.md) | 链上事件同步与到期任务 |
| [contracts](contracts/README.md) | Solidity 合约及测试 |
| [packages/shared](packages/shared/README.md) | 共享类型、金额和网络配置 |
| [deployments](deployments/README.md) | 合约 ABI、部署与历史链上证据 |
| [tests](tests/README.md) | 集成、端到端测试及报告 |
| [产品规格](docs/MVP-SPEC.md) | 用户、业务范围与结算规则 |
| [架构](docs/architecture.md) | 系统组件及数据边界 |
| [验收清单](docs/acceptance.md) | 验证进度、证据与待完成项 |
| [演示脚本](docs/contest/demo.md) | 完整产品演示场景 |
| [部署与恢复](docs/runbooks/deployment.md) | 部署配置与恢复操作 |

## AI 辅助与许可证

团队使用 Claude Code、GitHub Copilot 和 OpenAI Codex 辅助代码实现、测试及文档编写。AI 不参与产品内的争议裁决；自动化测试不能替代人工复核和独立资金审查。

项目原创代码采用 [MIT License](LICENSE)。OpenZeppelin、Next.js、React、viem、Mera、Foundry、Playwright 等第三方组件保留各自许可证，完整依赖见锁文件。

Copyright (c) 2026 RentBond contributors.
