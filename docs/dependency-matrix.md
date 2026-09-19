# 依赖与环境验证矩阵

成员C已安装并锁定Web依赖，pnpm-lock.yaml由实际安装生成。类型、逻辑、浏览器及构建证据见[交付指南](member-c-delivery.md)；不代表真机PRF或全栈兼容通过。

| 组件 | 基线选择 | 精确版本/状态 | 验证责任与证据 |
| --- | --- | --- | --- |
| Node.js | 骨架运行时 | 24.14.0；engines >=24.14.0 <25 | E；本次本地脚本检查 |
| pnpm | monorepo 管理 | 11.19.0；packageManager和lockfile已提交 | E；新 clone frozen install |
| Next.js / React / TypeScript | App Router 网页及 API | 16.3.5 / 19.3.0 / 5.9.3 | C/D；构建与路由 |
| viem | 账户与链交互适配（未引入wagmi） | 2.56.8；真实链交互待验 | B/C；正确网络和错误路径 |
| Mera | 默认 passkey 账户 | 0.2.0，preview；已编译，真机待验 | C；TS05 原地址恢复 |
| Privy | PRD 8.5 的替代候选 | 未启用 | C/D；Mera 失败后 ADR 与实测 |
| Foundry / Solidity / OpenZeppelin | 合约工具与安全库 | 待固定 | B；Monad 配置、合约测试 |
| PostgreSQL / Supabase Storage | 私有资料和投影 | 待固定及迁移 | D；TS03/04 和 ACL |
| RPC 与终局性策略 | Monad 测试网 + 备用同链 | 地址、chainId、确认策略待实测 | B/E；TS01/AT30 |
| Vercel / Render | PRD 中网页/Worker 候选 | 未开通/部署；额度区域待核 | E；成本、常驻 Worker 和可恢复性 |

新增依赖须写官方 URL、精确版本/tag/commit、许可证、使用目的和实测证据。只参考不复制第三方代码时也记录用途；不得用文档历史研究冒充当前 SDK 已验证。

## 本次Web依赖来源与许可

| 依赖 | 官方入口 | 精确版本 | 许可/用途 |
| --- | --- | --- | --- |
| Next.js | https://nextjs.org/docs | 16.3.5 | MIT；页面与构建 |
| React / react-dom | https://react.dev | 19.3.0 | MIT；界面 |
| TypeScript | https://www.typescriptlang.org | 5.9.3 | Apache-2.0；类型检查 |
| viem | https://viem.sh | 2.56.8 | MIT；地址、SIWE、账户适配 |
| Mera | https://github.com/category-labs/mera | 0.2.0 | MIT OR Apache-2.0；PRF临时签名会话 |
| Vitest | https://vitest.dev | 5.0.1 | MIT；逻辑测试 |
| Playwright | https://playwright.dev | 1.63.0 | Apache-2.0；桌面/手机测试 |

版本与许可证根据本次安装包package.json核对；Next使用本地随包文档，Mera调用依据0.2.0公开类型。类型辅助包精确版本见apps/web/package.json；传递依赖见锁文件。真实部署前由E复核依赖许可与供应商支持。
