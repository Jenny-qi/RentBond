# Web 页面与账户

## 2026-10-07 账户恢复与会话

正式恢复入口无需原地址、credential ID 或 localStorage：选择同一 passkey 后按固定 RP ID/派生盐重建账户，再 SIWE 读取该地址可访问的租约。手填地址只作为可选显式核对；错误密钥不能获得旧角色。页面显示 15 分钟会话的结束时间，签名前、私有请求及页面重新聚焦时检查到期，并保留每笔资金操作确认。

D 本轮同步修改账户/API 消费边界及回归；C/E 接口不变，无 ABI/schema 或依赖版本变化。验证见[本轮报告](../../tests/reports/2026-10-07-consumer-mera.md)，当前剩余验收见[赛道与奖项](../../docs/contest/track-fit.md)。下方 9 月 29 日“原地址缺失时恢复按钮禁用”为历史实现，已由本轮替换；两类真实设备、公网资金闭环和最终部署仍待取证。

C 负责页面、账户和本人确认交易；D 负责 `src/server/`、`app/api/`。本页合并原 C 交接说明，不再另外维护阶段群汇报。

## 当前实现

P01–P12 路由已切换为 `src/features/live/` 的真实 API/ABI 工作区；原 Alice 内存模型仅保留作回归测试，页面不再生成模拟交易 hash。

按用户的 Monad 黑客松展示要求，所有当前可见页面、导航、表单、确认弹窗、状态/错误及元数据统一为英文，HTML lang=en；日期固定英文格式并同时显示 UTC。用户输入、材料原文与链上数据不自动翻译。各租约页面通过 Overview / Terms & deposit / Checkout & evidence / Deductions / Settlement 导航；窗口关闭前显示明确标为不可领取的预计拆分。

- Mera 0.2.0 创建/恢复原地址、SIWE 签名与 HttpOnly 服务端会话；外部钱包为明确的兼容入口。账户/网络变化清私有页面与签名会话，签名密钥不落盘，15分钟后重新验证。
- 草稿、24小时邀请、版本编辑、冻结及本人创建；租客核对完整条款；精确 approve 与 fund 独立确认，支持撤销授权、取消未入金租约。
- 确认区块的统一余额快照与守恒校验、读取失败阻止资金操作；一次最多10项申索、逐项回应/撤回、截止后公开分配与领取。
- 提前交接、CHECKOUT/CLAIMS 主备处理、挑战、固定超时和最终退出；按实际 ABI 模拟后签署，拒绝签署不继续。
- 共同和解绑定准确 proposalId/revision/有效期；查看理由、材料、历史交易与固定受益人余额。
- 私有文件上传、不可覆盖版本、材料包提交和精确版本回应、追加撤回说明；异步导出和受限 Gas 请求/状态查询。
- 交易哈希保存在 sessionStorage（仅公开元数据），刷新后恢复同一账户可继续查询；超时不宣告失败，替换交易须核对发送人、目标、calldata、value 和成功回执；创建成功而 API 关联失败时重试关联，不重复部署。

服务端 `GET /api/cases/:id` 在原 caseAccess 检查后增加 `contractAddress` 和 `role`，供 R/F 页面读取相同合约；未扩大材料权限。ABI 直接引用 `deployments/abi/`，没有手写或修改共享 ABI/schema。请 D/E 以此响应继续联调。

## 运行

```sh
npm ci --prefix packages/shared
npm ci --prefix apps/web
npm run backend:init
npm run db:migrate
npm run dev --prefix apps/web
```

将环境放在 `apps/web/.env.local`，不要提交该文件。除了 D 的服务端配置，需要：

| 变量 | 说明 |
| --- | --- |
| NEXT_PUBLIC_APP_ENV | local 或 testnet；页面明确标识 |
| NEXT_PUBLIC_CHAIN_ID | 与服务端 CHAIN_ID、RPC、本人钱包一致 |
| NEXT_PUBLIC_RPC_URL | 浏览器可读且允许 CORS 的无凭证 RPC；不要放密钥。公网测试使用 HTTPS |
| NEXT_PUBLIC_FACTORY_ADDRESS | B/E 已核验的 Factory；不能填猜测地址 |
| CHAIN_CONFIRMATIONS | 页面和后端共同采用的确认数，不能把1个区块称为已核验的公网最终性 |
| NEXT_PUBLIC_APP_URL | 与实际访问 Origin 严格一致；真机使用 HTTPS，通行密钥绑定该域名 |

缺配置时不退回模拟或其他网络。测试服务须由团队配置、核验并导入，R/F 必须已接受；空服务列表会阻止创建。实际角色用自己的通行密钥/钱包，用户本人逐笔确认。后端事件投影可能等待下一轮同步，页面区分已确认链上余额与尚未同步的材料历史。

## 本次验证与未完成项（2026-09-29）

- `npm run test --prefix apps/web`：58/58 通过，无跳过；包含原前端模型、账户替身、后端权限与真实本地 EVM。新增5项真实前端适配器用例，不把替身视为设备测试。
- `npm run typecheck --prefix apps/web`、`npm run build --prefix apps/web`：通过。
- `node --test src/server/tests/live-chain.test.mjs`（在 apps/web）：补充前端真实读取后再次通过；验证准确 ABI、approve 未入金、错误条款摘要拒绝、R/F 案件地址/角色及最终金额。
- 浏览器实际查看首页和375像素登录页，原地址缺失时恢复按钮禁用；未创建本人凭证或签署公网交易。
- 依赖首次安装受 npm 缓存沙箱权限拒绝；按锁文件重新安装成功。该环境问题与源码测试结果分别记录。

仍需 B/E 的 DEMO_SHORT 已核验环境，C/D/E 的网页全链端到端演练、两类真实设备 HTTPS 同址恢复、真实钱包取消/替换/刷新流程与公网 700/100/200→850/150 证据。AT51 全站停运恢复由 E 联合验收；本页面登录仍依赖 API，不声称已完成停运独立入口。公众上传扫描/隔离为 D 的发布前提。上述完成前不标记 TS05 或 RB-08—11 为整体 Verified。

历史模拟页面验证保留在 [2026-09-25 原始测试记录](../../tests/reports/2026-09-25-member-c.md)，D 的运行方式见 [后端说明](src/server/README.md)。旧报告描述其当时版本，不代表当前页面仍为模拟。

## 2026-10-03 local browser automation

The shared E2E runner now drives the actual English pages, separate wallet confirmations, HTTP API and local EVM transactions through all eight local scenarios. Run from the repository root after generating ABIs and installing Chromium as described in [tests README](../../tests/README.md). See [browser report](../../tests/reports/2026-10-03-browser-e2e.md). This adds browser evidence to the prior 79-test Node suite; it does not certify real passkeys/devices or public Monad. No production page or API behavior was changed for testing.

## 品牌素材（2026-10-04）

按用户指定位置，导航使用原炭灰／暖金图形与白色字标组合，账户卡片不再单独展示图标，metadata 配置 favicon 与 Apple touch icon。素材未重绘，来源见 [品牌资源](public/brand/README.md)。本地 1280px 桌面与 375px 手机视口已检查图片加载及无横向溢出；TypeScript 检查通过。此项不涉及资金、权限、ABI 或账户逻辑。
