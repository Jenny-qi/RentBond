# 依赖与环境验证矩阵

当前 Node 骨架和本地合约工具已运行；网页供应商版本和 Monad 兼容性仍不是验证结果。尚无 pnpm 锁文件。

| 组件 | 基线选择 | 精确版本/状态 | 验证责任与证据 |
| --- | --- | --- | --- |
| Node.js | 骨架运行时 | 24.x（最小 24.14.0）；doctor.mjs 检查 24.x | E；scripts/doctor.mjs 本地验证 |
| pnpm | monorepo 管理 | 待 RB-02 固定 packageManager 和 lockfile | E；新 clone frozen install |
| Next.js / React / TypeScript | App Router 网页及 API | Web 包固定 15.5.9 / 19.1.4 / 5.9.2；npm 锁文件，根 pnpm 待 RB-02 | C/D；[C 本地报告](../tests/reports/2026-09-25-member-c.md) |
| viem / wagmi | 链交互与读取 | viem 2.56.9；wagmi 未启用，真实链兼容未验收 | C；Mera 签名适配单元检查，不代表 RPC/资金联调 |
| Mera | 默认 passkey 账户 | @category-labs/mera 0.2.0；preview；已接地址创建/核对试验，真机待验证 | C；[派生 ADR](decisions/0002-mera-account-trial.md)、TS05 未通过 |
| Privy | PRD 8.5 的替代候选 | 未启用 | C/D；Mera 失败后 ADR 与实测 |
| Foundry / Solidity / OpenZeppelin | 合约工具与安全库 | Forge 1.7.1（npm wrapper）；Solidity 0.8.24；OpenZeppelin ReentrancyGuard 5.0.2；本地已编译测试，Monad 待验 | B；[本地报告](../tests/reports/2026-09-21-contracts-local.md)、TS01/02 |
| PostgreSQL / Supabase Storage | 私有资料和投影 | 待固定及迁移 | D；TS03/04 和 ACL |
| RPC 与终局性策略 | Monad 测试网 + 备用同链 | 地址、chainId、确认策略待实测 | B/E；TS01/AT30 |
| Vercel / Render | PRD 中网页/Worker 候选 | 未开通/部署；额度区域待核 | E；成本、常驻 Worker 和可恢复性 |

新增依赖须写官方 URL、精确版本/tag/commit、许可证、使用目的和实测证据。只参考不复制第三方代码时也记录用途；不得用文档历史研究冒充当前 SDK 已验证。

2026-09-25 C 依赖交接：Mera 0.2.0（[官方](https://github.com/category-labs/mera)，MIT 或 Apache-2.0）用于浏览器 PRF 与短生命周期签名会话；viem 2.56.9（[官方](https://github.com/wevm/viem)，MIT）用于验证 Mera EVM 签名适配。安装与构建在 Node 24.14.0 完成；首次下载遇 ECONNRESET，重试成功。仅网页包变更，不改共享 schema、ABI 或根锁文件；E 合并 RB-02 时应统一该精确版本集合，D 的 API 继续使用同一个 Web 包。未向远端发送交接消息。
