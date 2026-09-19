# Web 页面与账户

C 负责页面、components、features；D 负责 app/api 和 server。本次实现 Next.js 前端和显式纯内存演示，真实服务未接入。

从仓库根运行 `pnpm install --frozen-lockfile`、`pnpm dev`，打开 http://127.0.0.1:3000，点击“体验部分结算”。角色/场景切换清空未提交表单，刷新清空演示记录。

`pnpm check` 执行文档检查、类型检查和单元测试；`pnpm build` 执行生产构建。先执行 `pnpm --filter @rentbond/web exec playwright install chromium`，再运行 `pnpm test:web:e2e`。本地测试可以复用3000端口已有的本项目服务器。

账户只保存公开索引，密钥仅存在SDK临时签名会话。恢复必须匹配原地址。配置文件为 `apps/web/.env.local`，可填写经B/E核实的 `NEXT_PUBLIC_CHAIN_ID`；缺失时禁止登录签署。不存在的API返回404，不使用假成功或虚构数据兜底。

页面覆盖、源文件职责、验证与B/D/E接入步骤见 [成员C交付指南](../../docs/member-c-delivery.md)。API客户端DTO为提案；交易transport需B的ABI和E的确认策略才能用于真实资金操作。
