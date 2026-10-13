# 验收清单

## 2026-10-13 Mera transaction signing

Fixed loss of the local Mera signer when a simulated contract request overrides
the wallet client account. Ten focused tests and type checking passed; the
production frontend still requires deployment and a real confirmed transaction.
This does not mark the Mera public-chain flow Verified. See the
[regression report](../tests/reports/2026-10-13-mera-signing-fix.md).

## 当前状态（2026-10-12）

线上部署（rentbond.vercel.app）：
- 前端：Vercel HTTPS ✓
- 后端 API + Worker：Azure ✓
- 数据库、存储、隔离区、病毒扫描、RPC 五项健康检查全部通过 ✓
- 正式 API 已验证：SIWE 登录、权限隔离、文件上传/扫描/导出/下载、退出登录 ✓
- 服务方案已注册并导入（DEMO_SHORT）✓
- Tenant 账户持有 1,000 MockUSD，四个角色均有测试 MON ✓

本地工作区：
- 类型检查：0 错误
- Integration：9 passed / 0 failed / 0 skipped
- E2E：8 项本地 Chromium 场景通过
- 生产构建：成功

## 待完成

以下项目需真实网页钱包操作完成，当前状态为 pending，不是失败：

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| MetaMask 安全分类 | pending | 显示"Malicious"警告，原因未查明，已提交人工复核 |
| 网页创建租约 → 领取完整公网流程 | pending | 钱包签名因 MetaMask 警告暂停，非流程失败 |
| Worker 自动推进交易 | pending | WORKER_EXECUTE=false，演示前需确认推进方式 |
| 3 分钟演示视频 | pending | — |
| 第二人独立复现 | pending | — |
| 独立资金审查 | pending | — |

## 线上验证报告

生产仓实时验证记录（保留在 `tests/reports/`）：
- `2026-10-12-live-status.md` — 线上健康状态
- `2026-10-12-service-profile-import.md` — 服务方案导入核验
- `2026-10-12-live-lease-preparation.md` — 租约创建预检
- `2026-10-12-targeted-security-review.md` — 依赖安全更新
- `2026-10-11-azure-live-backend.md` — Azure 后端上线确认
- `2026-10-11-public-api-acceptance.md` — 公网 API 切片验证
- `2026-10-11-lease-readiness.md` — 创建前置条件确认

## 赛道与奖项

参赛赛道：**Consumer Products & Payments**
赞助商候选：**Best Mera-Powered UX on Monad / Monad Foundation**

完整奖项证据要求见 [track-fit.md](contest/track-fit.md)。
