# 成员 C 任务检查与交接

检查日期：2026-09-25。基线 commit：`78e8cd4406e5a4d6b5a0324834f535c1efc23f49`；以下实现仍在未提交工作区。依据 README、MVP、PRD 6/7/8/11、team 和 backlog。**成员 C 尚未全部完成，不能标记 Verified。**

## 逐任务结论

| Issue | 已有内容与本次补充 | 尚缺内容 | 状态 |
| --- | --- | --- | --- |
| RB-08a | 模拟账户同地址检查、错误网络、取消/切换身份清理；已接 Mera 0.2.0 地址创建/恢复核对试验 | TS05 两类真实设备恢复、SIWE、受限 Gas、原账户停运恢复 | In progress |
| RB-09 | P02/04/05/06 页面；条款确认、精确授权、存入、撤销授权及取消的前端模拟流程 | 持久草稿、限期邀请、完整条款/服务方案、真实 Factory/accept/fund 与事件确认 | In progress |
| RB-10 | P07/09 资金展示；最多 10 项申索表单、逐项回应/撤回、到期分配；读取失败保留余额并阻止操作 | 私有文件上传/版本/承诺值、P08 完整 CHECKOUT、真实 ABI/API/投影接入 | In progress |
| RB-11 | P10/11/12；多项结果完整覆盖与逐项上限、主结果成熟/挑战/F/主处理超时/hardEnd 退出模拟、同一提案 ID 和有效期、累计领取 | 实际期限/链上模拟/交易替换与恢复、真实导出与历史流水 | In progress |

页面存在不等于业务完成。虚构模型仅用于前端开发，不能替代合约状态机、链上 ACL 或 TS/AT。

## 本次修改文件与目的

- `apps/web/src/features/leases/types.ts`、`model.ts`、`workflow.ts`、`LeaseProvider.tsx`：未入金状态和资金守恒、单次清单、截止前不分配、回应/撤回、固定提案 ID、多项结果验证。
- `apps/web/src/features/leases/ClaimComposer.tsx`、`ClaimsProgress.tsx`：房东清单表单和明确标注的虚构时点推进。
- `apps/web/src/features/leases/model.test.mjs`、`workflow.test.mjs`：金额、边界、旧提案和逐项上限回归测试。
- `apps/web/src/features/tx/TxProvider.tsx`、`components/Providers.tsx`：待确认操作绑定状态版本；切换账户或重置场景取消模拟计时器和表单。
- `apps/web/src/components/DemoScenarios.tsx`、`Shell.tsx`、`app/globals.css`：可重置的演示入口、读取失败提示、移动布局和状态条遮挡修复。
- `apps/web/src/app/invite/[token]/page.tsx`、`leases/[id]/fund/page.tsx`、`claims/page.tsx`、`settlement/page.tsx`、`cases/[caseId]/page.tsx`、`resolver/page.tsx`：连接前端流程，区分未入金/未分配/待生效/已领取。
- `apps/web/package.json`、`package-lock.json`、`.gitignore`：网页包检查入口、依赖和构建产物忽略。仓库级 pnpm 锁文件仍由 RB-02 统一。
- `apps/web/src/features/account/mera.ts`、`MeraTrial.tsx`、`mera.test.mjs`、`app/login/page.tsx`：真实 SDK 的独立地址试验、同址恢复验证、取消处理、公开测试向量的签名检查。派生方案见 [ADR 0002](decisions/0002-mera-account-trial.md)。

## 本地复现

在根目录运行：

```sh
npm ci --prefix apps/web
npm run test --prefix apps/web
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
npm run dev --prefix apps/web
node scripts/doctor.mjs
node scripts/check-scaffold.mjs
```

页面底部“本地演示场景与故障测试”可切换未入金与 700/100/200。未入金流程：租客登录 → 加载未入金 → P06 跳转邀请确认 → approve → fund → P09 加载租期结束 → 切换房东提交 100/200 → 切回租客认可 100、争议 200 → 加载申索截止并执行分配。场景推进不是真实链时间，也不发交易。刷新清除本次内存进度。

## 联调交接与真实阻塞

| 提供方 → C | 当前证据 | 必须补齐 |
| --- | --- | --- |
| B → C | 有 Solidity 源码，`deployments/` 仅 example 模板；本地未提供固定 ABI 包 | 从已固定源码产物导出的 ABI、部署网络/地址/区块/交易、服务方案与错误、确认策略 |
| D → C | `app/api/` 和 `server/` 当前仅 README；API 文档仍为提案 | 冻结 DTO/schema，SIWE/会话/邀请/草稿/文件/导出/Gas 路由与权限测试 |
| E → C | 根应用命令仍为明确失败占位 | pnpm workspace 锁定、链读/事件确认策略、跨层环境和第二人复现 |
| C/测试设备 | 自动化浏览器不能证明真实 passkey PRF 或跨设备恢复 | 在明确 HTTPS RP 域名及实际目标设备运行 TS05，逐次由本人操作凭证和签名 |

不临时手写 ABI、不创建虚假部署地址、不用浏览器 localStorage 冒充 SIWE、不静默改用新地址。C 内仍未实现的条目保留在上表，不全部归咎外部依赖。

## 验证证据

结果记录见 [本地前端报告](../tests/reports/2026-09-25-member-c.md)。未提交源码、设备测试和跨层条件未满足前不升级 AT/TS 为 Verified。
