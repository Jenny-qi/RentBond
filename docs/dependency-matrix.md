# 依赖与环境验证矩阵

当前 Node 骨架和本地合约工具已运行；网页供应商版本和 Monad 兼容性仍不是验证结果。尚无 pnpm 锁文件。

| 组件 | 基线选择 | 精确版本/状态 | 验证责任与证据 |
| --- | --- | --- | --- |
| Node.js | 骨架运行时 | 24.x（最小 24.14.0）；doctor.mjs 检查 24.x | E；scripts/doctor.mjs 本地验证 |
| pnpm | monorepo 管理 | 待 RB-02 固定 packageManager 和 lockfile | E；新 clone frozen install |
| Next.js / React / TypeScript | App Router 网页及 API | 待固定 | C/D；构建与路由 |
| viem / wagmi | 链交互与读取 | 待兼容验证 | B/C；正确网络和错误路径 |
| Mera | 默认 passkey 账户 | 待固定，PRD 提示 preview 风险 | C；TS05 原地址恢复 |
| Privy | PRD 8.5 的替代候选 | 未启用 | C/D；Mera 失败后 ADR 与实测 |
| Foundry / Solidity / OpenZeppelin | 合约工具与安全库 | Forge 1.7.1（npm wrapper）；Solidity 0.8.24；OpenZeppelin ReentrancyGuard 5.0.2；本地已编译测试，Monad 待验 | B；[本地报告](../tests/reports/2026-09-21-contracts-local.md)、TS01/02 |
| PostgreSQL / Supabase Storage | 私有资料和投影 | 待固定及迁移 | D；TS03/04 和 ACL |
| RPC 与终局性策略 | Monad 测试网 + 备用同链 | 地址、chainId、确认策略待实测 | B/E；TS01/AT30 |
| Vercel / Render | PRD 中网页/Worker 候选 | 未开通/部署；额度区域待核 | E；成本、常驻 Worker 和可恢复性 |

新增依赖须写官方 URL、精确版本/tag/commit、许可证、使用目的和实测证据。只参考不复制第三方代码时也记录用途；不得用文档历史研究冒充当前 SDK 已验证。
