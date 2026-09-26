# Web 页面与账户（成员 C）

C 负责页面、通行密钥账户体验、交易确认与资金拆分展示。D 仍负责 `src/app/api/` 与 `src/server/`，本目录没有实现那些路由。

## 当前交付

已实现 P01–P12 路由与 Metropolis 风格玻璃拟态界面（大气背景、玻璃卡片、金额优先）。界面始终展示 **Monad 测试网 · 测试资产，无现金价值**。Alice 案例 1,000 → 700 / 100 / 200 使用**明确标注的虚构数据模式**，不是链上验收。

默认账户路径按 PRD 为 Mera passkey。登录页新增真实 Mera 0.2.0 的地址创建/恢复核对试验，与 Alice 虚构身份隔离；尚未通过 TS05 真机和 SIWE/Gas 联调。主 Demo 登录/恢复及外部钱包入口仍为模拟，不同地址不能假装恢复，取消签署不继续执行。

## 本地预览（不改根目录 `pnpm dev` 占位）

根脚本 `pnpm dev` 仍由 E 的 RB-02 接线。C 可在本包启动页面：

```sh
cd apps/web
npm ci
npm run dev
```

打开 http://localhost:3000 。需要 Node 24。不要把本次 `npm install` 当成仓库级 lockfile 已冻结。

## 路由

| 页面 | 路径 |
| --- | --- |
| P01 首页 | `/` |
| P02 登录 | `/login` |
| P03 列表 | `/leases` |
| P04 创建 | `/leases/new` |
| P05 邀请 | `/invite/[token]` |
| P06 入金 | `/leases/[id]/fund` |
| P07 工作台 | `/leases/[id]` |
| P08 交接 | `/leases/[id]/checkout` |
| P09 扣款 | `/leases/[id]/claims` |
| P10 案件 | `/leases/[id]/cases/[caseId]` |
| P11 处理人 | `/resolver` |
| P12 领取 | `/leases/[id]/settlement` |

## 非目标

不手写与合约不符的 ABI；不把 approve 显示成已入金；不根据 token 余额倒推 D；不删除备用处理入口；不提交密钥。真实 AT12/TS05 仍依赖 B/D/E。

## 2026-09-21 续做

修复累计领取、和解份额与双方确认，增加主结果生效/备用处理/超时分配的模拟状态和测试，取消账户切换与离页后的模拟操作。完整状态与未完成工作见 [成员 C 交付记录](../../docs/member-c-handoff.md)。页面存在不表示 RB-08—11 已全部完成。

本地检查：`npm run test --prefix apps/web`、`npm run typecheck --prefix apps/web`、`npm run build --prefix apps/web`（均从根目录运行）。测试覆盖前端虚构模型与 SDK 适配器，Web npm 依赖已精确固定；仓库 pnpm lockfile、真实 ABI/API 联调仍未完成。

2026-09-25：补入金演示起点、清单提交/回应/撤回、到期分配、旧提案 ID/有效期、逐项结果上限、主处理超时和最迟退出；新增真实 Mera 试验。数据读取失败时禁止依赖金额的操作。最新修改清单、命令、结果与未完成项见上方交付记录。
