# Web 页面与后端

C 负责页面与账户交易，D 负责服务端 API/数据库，E 负责 Worker 与跨层测试。

## 当前实现

P01–P12 路由使用 `src/features/live/` 的真实 API/ABI 工作区；所有页面统一英文。

- **Mera 0.2.0** 创建/恢复 passkey 账户、SIWE 签名与 HttpOnly 会话；外部钱包为明确兼容入口
- 草稿邀请、版本冻结、精确 approve/fund 独立确认、撤销授权
- 确认区块余额快照与守恒校验；一次最多 10 项申索、逐项回应/撤回
- 提前交接、CHECKOUT/CLAIMS 主备处理、挑战、固定超时和最终退出
- 私有文件上传、不可覆盖版本、材料包提交和导出
- 交易哈希保存在 sessionStorage，刷新后可继续查询

## 运行

```sh
cd apps/web
pnpm install --allow-build=esbuild --allow-build=core-js
npm run backend:abi
npm run backend:init
npm run db:migrate
npm run backend:seed
npm run dev
```

环境变量放在 `apps/web/.env.local`，不要提交。必需配置见[后端运行说明](src/server/README.md)。

## 验证状态

- 类型检查：0 错误
- 集成测试：9 passed / 0 failed / 0 skipped
- E2E 测试：8 项本地 Chromium 场景
- 后端健康：`/api/health` → `rpc: true`（Monad 测试网）

真实设备恢复、公网资金闭环、公网部署和独立资金审查仍待完成。

## 品牌素材

导航使用团队灰白/灰金深底 Logo，favicon 和 Apple touch icon 已配置。
详情见 [public/brand/README.md](public/brand/README.md)。
