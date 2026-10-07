# Consumer Products & Payments / Mera UX 核对

更新：2026-10-07；本轮基于 main `4a34c3096e8e28184e4ec9f2ba29096694eddc20` 完善。建议继续锁定赛道 02；Monad Foundation 的 **Best Mera-Powered UX on Monad** 保留为主攻候选，真机、实际 Monad 操作及当前正式条款核对完成前不宣称已满足全部奖项要求。

## 四个问题

1. **是否契合赛道二？** 是，主要消费者是普通跨境租客，小型房东参与结算；核心价值是理解扣款、回应争议、领取押金，不依赖交易、做市或收益活动。目标用户采用仍是待验证假设，双方必须事先同意并把押金存入合约。
2. **如何增强契合度？** 本轮消除无缓存恢复必须手填地址的障碍，突出既有 passkey 登录和可见的会话期限，保留每笔资金操作的明确确认。下一步用真实用户验证首次五分钟的邀请、条款、入金与取消体验，并分别记录预计、可领取及已领取金额的理解情况。
3. **Mera 是否实质体现？** 正式页面已有 Mera passkey/PRF 派生 EVM 账户、SIWE 登录和 viem 交易签名，本轮补齐无缓存恢复及其权限回归。代码和本地证据支持“已实质集成”，仍需真实设备及 Monad 测试网录像、回执证明用户体验与奖项条件。
4. **契合、问题、改进和风险？** 押金结算的消费者金融场景明确，本轮完成账户恢复、会话及提交说明的可落实改进。未完成项集中在真实设备兼容性、公众环境、完整公网资金闭环、成片与独立复核；MockUSD 无现金价值，合约无法判断证据真伪或保证裁决公正。

## 契合—问题—建议—证据

| 契合 | 问题 / 风险 | 建议与本轮处理 | 证据 |
| --- | --- | --- | --- |
| 租客是消费者，押金是生活金融体验 | 用户画像不等于已有真实用户；已经付给房东的押金无法追回 | README 明示事前同意、目标用户与采用边界；不扩展为交易或做市 | [MVP](../MVP-SPEC.md)、[研究范围](../research/README.md)、[README](../../README.md) |
| 逐项回应可减少整笔押金等待 | 预计、可领取、已领取容易混淆 | 保留按实际合约状态展示；README 修正窗口关闭、确认分配、领取确认三个阶段 | [金额页面](../../apps/web/src/features/live/LivePage.tsx)、[金额回归](../../apps/web/src/features/leases/model.test.mjs) |
| Passkey 减少助记词、扩展与手填地址负担 | 原来清缓存后必须提供原地址；创建新密钥可能误认为恢复 | **已改**：可直接选择既有可发现凭证，固定域名与派生盐；地址只作显式可选核对，不读取本地缓存作恢复门槛 | [wallet.ts](../../apps/web/src/features/live/wallet.ts)、[登录页面](../../apps/web/src/features/live/LivePage.tsx) |
| 恢复后继续原租约、材料和导出 | 另一把 passkey 可能派生新地址，不能自动继承角色 | **已验证本地切片**：原账户重新 SIWE 后访问原租约和材料；旧下载链接失效；其他账户无权读取或导出 | [Mera/SIWE/ACL 测试](../../apps/web/src/server/tests/mera-recovery.test.mjs) |
| 同会话免重复 passkey 提示 | 应用签名会话不是链上限制型 session key；后台标签页计时器可能延迟 | **已改**：显示实际结束时间和确认范围；到期、重新聚焦、私有请求及签名前检查期限；退出销毁签名会话 | [LiveProvider](../../apps/web/src/features/live/LiveProvider.tsx)、[浏览器回归](../../apps/web/src/server/tests/browser.e2e.mjs) |
| Mera 在正式账户和交易链路中使用 | 仅安装依赖或旧 trial 不构成奖项证明；“账户抽象”易误读 | **已改**：明确为 Mera 0.2.0 passkey 派生 EVM 签名账户；不声称 ERC-4337、Paymaster 或无需网络手续费 | [SDK 适配](../../apps/web/src/features/live/wallet.ts)、[viem 客户端](../../apps/web/src/features/live/client.ts)、[README](../../README.md) |
| 无助记词的入门流程 | SDK 在创建时没有 PRF 输出会增加一次认证；不保证每台设备只有一次提示 | **已加测试**覆盖回退认证；在真机记录系统提示次数、取消、PRF 支持情况，不用脚本替代设备证据 | [适配器测试](../../apps/web/src/features/live/client.test.mjs)、Mera 0.2.0 `dist/passkey.js` |
| 测试手续费可受限补给 | 补给可能离线、余额不足或到达配额；不等于法币入金 | 清楚标注测试 MON 仅用于手续费、确认后才到账；部署验收实际测试配额及拒绝路径 | [导出/费用页面](../../apps/web/src/features/live/ui.tsx)、[后端说明](../../apps/web/src/server/README.md) |
| 有 Monad 历史部署及 1,000 MockUSD 入金 | 历史快照 `readyForFrontend: false`；未完整证明公网 850/150、900/100 领取 | **已改**：分别列出创建与入金哈希；B/C/E 完成 DEMO_SHORT 配置、角色本人确认、余额及回执索引 | [历史链上证据](../../deployments/monad-testnet-2026-09-26.chain-evidence.json)、[部署说明](../../deployments/README.md) |
| 源码公开、MIT、运行文档与视频脚本已有 | 仍无公开成片和完整独立复现记录；AI 披露不完整 | **已改**：补 D 的 Codex 使用范围、正确依赖版本和运行命令、历史文档链接；人工审阅保持待确认 | [提交要求](contest-requirements.md)、[165 秒脚本](demo.md)、[本轮验证](../../tests/reports/2026-10-07-consumer-mera.md) |

## 证据层级

- **源码**：`layout.tsx` 挂载 LiveProvider；`openPasskey` 调用 Mera；账户签署 SIWE 后建立 HttpOnly 会话；同一账户执行用户确认的 `writeContract`。这证明集成路径存在。
- **本地回归**：本轮命令、结果与限制统一在[验证报告](../../tests/reports/2026-10-07-consumer-mera.md)。注入 WebAuthn 输出的测试使用真实 Mera 派生和 SIWE 签名，但不能验证物理设备 PRF；EIP-1193 浏览器替身与本地 Hardhat 也不等于 Monad 公网。
- **历史公网**：9 月 26 日的地址、创建和入金记录已保存。它们不是本轮 Mera 端到端测试，不证明当前部署、分配与领取已验收。
- **待取证**：真实设备、跨设备恢复、公网完整领取、最终部署 ACL、公开成片和独立审核。没有实际执行结果就保持 Not run / In progress。

## 继续锁定奖项前的验收

| 负责人建议 | 实际操作 | 必须保存的证据 | 当前状态 |
| --- | --- | --- | --- |
| A | 登录提交平台核对当前赛道及 Mera 奖项完整条款 | 原文 URL、核查时间、版本/截图与提交字段 | 详细页当前原文待核实 |
| C/D/E | 稳定 HTTPS 域名创建 passkey；清 cookies、localStorage、sessionStorage 后仅凭原 passkey 重新登录 | 域名、设备/OS/浏览器/凭据提供方、原/恢复地址、可访问原租约、系统提示数与录像 | 代码和本地回归已补；真机 Not run |
| C/E | 同一 passkey 在第二类兼容设备恢复；选另一把密钥和取消认证 | 同址恢复及原租约访问；错误账户无权限；取消不签名 | 真机 Not run |
| B/C/E | Mera 账户在 Monad 测试网实际交易；700/100/200 到 850/150，并补 900/100 超时领取 | 固定代码 commit、DEMO_SHORT 参数、合约地址、交易哈希、区块、余额、角色本人确认片段 | 完整公网流程 Not run |
| A/C | 测试邀请到首次操作的前五分钟，并制作不超过三分钟成片 | 点击数、耗时、提示数、取消/失败卡点、真实操作视频 URL | 用户研究和公开成片 Not run |
| D/E | 所选 HTTPS/PostgreSQL/Worker/私有存储/扫描环境验收，第二人新 clone 与恢复演练 | 真实部署 ACL、扫描隔离、恢复日志、审阅者及结论 | 所选公网环境与独立复核 Not run |

跨设备恢复以同一凭证及 PRF 能力可用为前提，不承诺丢失全部 passkey 后可恢复。设备/录像记录不收集密钥、PRF 字节、会话 cookies 或真实租约材料。无需购买指定云产品；真机需要稳定可达的 HTTPS，成本取决于团队选择的托管、存储和 RPC 方案。

## 规则来源

- 队长提供的四轨道定义及公共源码、可运行 Monad 产品、视频和文档要求。
- [官方公开赛道与奖项页](https://monad.xyz/developers/hackathons/metropolis)：2026-10-07 核查看到赛道 02 对首次五分钟体验的强调，以及 Monad Foundation / Best Mera-Powered UX on Monad 奖项卡。
- [奖项详细入口](https://hackathon.monad.xyz/tracks/best-mera-powered-ux-on-monad)：上轮核查跳转登录；单次 passkey 仪式、会话、仅凭 passkey 恢复等细项依据队长提供的 2026-09-29 建议 PDF 第 3—4 页，尚需 A 核对当前平台原文。不能将历史建议稿视为现行完整规则。

赛道 01 主要面向交易者/构建者，03 以社交文化为核心，04 是供其他应用使用的基础设施；它们都不如赛道 02 符合当前租客押金结算主流程。最终资格与评分由赛事条款及评审决定，不虚构量化“契合率”。
