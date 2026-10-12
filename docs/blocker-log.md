# 当前阻塞与验收状态

## 主要阻塞

**MetaMask 安全分类** — rentbond.vercel.app 被标记为"Malicious"，原因未查明，已提交人工复核。钱包签名暂停，非流程失败。

**完整公网资金流程** — 网页创建租约 → 接受条款 → 授权及入金 → 扣款与争议处理 → 领取，因 MetaMask 警告暂停，待警告解除后继续。

**Worker 自动推进** — WORKER_EXECUTE=false，演示前需确认链上推进方式。

**3 分钟演示视频** — pending。

**第二人独立复现** — pending。

**独立资金审查** — pending。

## 当前已解决

- 服务方案（DEMO_SHORT）已注册并导入后端 ✓
- Tenant 账户持有 1,000 MockUSD ✓
- 四个角色均有测试 MON ✓
- Azure 后端 + Vercel 前端部署上线 ✓
- 五项健康检查全部通过 ✓
- 公网 API（SIWE、上传、扫描、导出、权限隔离）已验证 ✓
- 依赖安全更新已完成 ✓

## 赛道

**Consumer Products & Payments**，赞助商候选：**Best Mera-Powered UX on Monad / Monad Foundation**
