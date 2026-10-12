# 现有 Vercel 在线入口的恢复

2026-10-10 源码基线：`d325de069d26b2fff950425f3339aa22c6e84047`。
已观察入口：`https://rentbond-nine.vercel.app`。本轮读取 `/api/health` 返回 503，正文为 `Backend is not configured or unavailable.`；这只说明后端初始化失败，**无法确认究竟缺哪个变量或服务**。当前没有项目日志/设置访问权，未改线上配置，也未发布。

## 先读取现有项目，保留已有环境

项目拥有者打开 Vercel 项目，核对当前部署的 Git commit、Root Directory（当前 Web 为 `apps/web`）、构建命令、Node 24.x、生产/预览变量作用域。在 Runtime Logs 中筛选 `/api/health` 并保存错误事件。不要删除、重建数据库或替换团队已有项目来尝试解决 503。

应用本轮诊断补丁并重新部署后，公开响应仍不包含私有错误。用响应中的 `requestId` 搜索服务端 JSON 事件 `backend.unavailable`。无需把变量值、数据库连接串、JWT、Cookie、Storage key、钱包私钥发给其他人。

| 日志 category | 意义与下一步 |
| --- | --- |
| configuration_invalid | 配置读取失败；本地运行下述离线检查，在项目拥有者环境核对变量完整性 |
| database_unavailable | 数据库连接、DNS、容量或目标库问题；核对网络与项目中的连接配置 |
| database_authentication | 数据库账号认证失败；由拥有者核对已有账号，不把密码贴进日志 |
| database_permission | 数据库权限不足；与 D 核对已有应用角色权限 |
| migration_required | 迁移表/所需迁移未读到或查询失败；核对实际目标库和已有迁移记录，连接错误也可能落在此类别，须继续调查 |
| services_initialization | 存储、扫描或链客户端对象初始化失败；先核对其配置，再实际运行服务验收 |
| backend_unknown | 尚未分类；诊断补丁不能替代项目拥有者的服务调查 |

日志只提供阶段和固定类别，不能保证仅凭类别确定根因。运行中 API 的原有错误处理保持不变。

## Vercel 保留网页/API，依赖服务独立运行

当前 API 与页面属于同一 Next.js 应用，不存在一个现成 `BACKEND_URL` 变量可填来解决所有问题。API 用 `DATABASE_URL` 连接 PostgreSQL，用 `STORAGE_URL` + `STORAGE_SERVICE_KEY` 访问已有 Supabase Storage 适配器，用 `CLAMAV_HOST/PORT` 连接受限扫描服务。两类 Worker 是常驻进程，需由独立主机运行，不能仅启动 Vercel 网页就视为已运行。

| 部分 | 现有实现要求 |
| --- | --- |
| 网页构建 | `NEXT_PUBLIC_APP_ENV=testnet`、固定 HTTPS Origin、`NEXT_PUBLIC_CHAIN_ID=10143`、无凭证浏览器 RPC、核验后的 Factory/Registry 地址 |
| 服务端 | `CHAIN_ID=10143`、`RPC_URL`、独立高熵 `SESSION_SECRET`、共享 PostgreSQL |
| 文件 | 适配器支持的持久私有对象存储、分离的 private/quarantine buckets，实际 policy/ACL 验收；Vercel 函数里的本地目录不能当作共享持久存储 |
| 扫描 | 真实 ClamAV、更新病毒库、仅允许获准服务访问；不能向互联网裸露未鉴权的 clamd 端口，不能用 disabled-local 绕过 |
| Worker | Web 与两个 Worker 连接同一 DB、同一对象存储/会话配置、核验后的部署块，初始 `WORKER_EXECUTE=false` |

在项目拥有者电脑上把用于核对的变量保存为 Git 忽略目录中的私有文件，限制访问权限；此文件应包含 Web 与独立 Worker 的共同配置。脚本只报告检查项名称，不输出值：

```sh
node infra/staging/check-hosted.mjs private/hosted.env
```

退出 0 仅证明变量格式满足这条部署路线，不证明服务可达、已迁移、bucket 私有、扫描正常、Worker 正在运行或链上闭环。校验失败不会自动修改环境。数据库的 TLS、连接额度、区域和连接方式须按实际提供方设置，不关闭证书验证来排障。

由 D 在固定版本和核对过的目标库上备份、检查迁移，再执行仓库已有 `db:migrate`；不在每次 HTTP 请求里自动迁移。由 D/E 启动独立 `backend:worker` 与 `worker:dev`。在相同配置环境运行现有 `backend:verify-deployment`，验证真实数据库、私有存储和 EICAR 扫描。

`NEXT_PUBLIC_*` 在构建时冻结，修改后须重新构建部署。健康检查通过后继续：

```sh
node infra/staging/smoke.mjs https://rentbond-nine.vercel.app
```

这个检查需要所有依赖均为真实健康，不接受扫描绕过或未配置 RPC。它不代替登录、角色权限、Worker 恢复、实际设备及 Monad 交易验收。服务清单为空还需要导入已审核、链上 R/F 都接受的服务方案；不能 seed 虚构已入金租约来解锁创建。

## 如果现有外部服务不可用

已有 `infra/staging/compose.yaml` 是一个单 Linux 主机候选：Web/API、PostgreSQL、私有持久目录、真实 ClamAV、两个 Worker 与可选 HTTPS。它不应直接应用到 Vercel。确定可用主机/域名后按 [部署说明](README.md) 接入；先验证，不删除现有 Vercel 项目。

通行密钥绑定实际域名；切换域名可能无法使用原域名的 passkey。优先保持团队选定的稳定 Origin，迁移需由 C 用真实设备验证，不能假设同址恢复跨域自动成立。

参考：[Vercel Functions runtime](https://vercel.com/docs/functions/runtimes/node-js)、[Vercel Function limits](https://vercel.com/docs/functions/limitations)、[Next.js 环境变量](https://nextjs.org/docs/app/guides/environment-variables)。本说明为上线准备，不宣布线上恢复或正式验收完成。
