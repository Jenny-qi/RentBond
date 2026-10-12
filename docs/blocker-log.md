# 当前提交与验收阻塞

2026-10-11 前置阻塞明确：后端没有已核验服务方案，需原部署人提供与现有链上承诺一致的服务方案 JSON 和 salt；历史 R/F 授权仍有效。Tenant MockUSD 余额为 0，仅指定 mintOperator 可补测试资产；自动 MON 补给未配置。Worker 仍差 4,645,090 区块。前轮 Azure 通信错误的执行结果已由 VM 留存 PASS 输出和独立文件哈希核对补证；同机恢复通过，异地／数据库恢复仍待验收。详见[核对记录](../tests/reports/2026-10-11-lease-readiness.md)。

2026-10-11：正式网址的临时账户上传、扫描、导出及权限切片已通过，后端运行阻塞已有实质解决。MetaMask 安全分类、钱包／真机／资金验收仍独立阻塞；服务方案、Gas 补给及完整备份需继续核对。Azure 后续复验出现通信错误，不把不确定结果记为通过。见[本轮报告](../tests/reports/2026-10-11-public-api-acceptance.md)。

2026-10-10：已有 Vercel HTTPS 入口，但 health/session 仍返回初始化 503；项目配置和日志缺访问权。已准备无密钥泄露的阶段诊断、当前 main 的部署补丁与 Vercel 接入说明。GitHub 写入 403，改动未进入远端；本地文档检查通过不等于远端 CI 修复。公网、Worker、真实 Monad 与真机验收仍阻塞。见[本轮记录](../tests/reports/2026-10-10-live-product-recovery.md)和[Vercel 恢复说明](../infra/staging/VERCEL_RECOVERY.md)。

2026-10-08 最终演示就绪复查：当前本机 Worker 缺失 viem 安装，Integration 5 passed / 4 failed / 0 skipped；Playwright 安装缺失，本轮未跑 E2E。四处品牌报告引用的文件不存在，文档检查失败。先恢复锁定依赖、补原始证据并重跑，再完成 DEMO_SHORT、真机和所选环境演练、冻结录像版本。P1 邮件/短信默认提供方仍为占位，不能宣称送达。详见[命令、结果和待办](../tests/reports/2026-10-08-demo-readiness.md)；下方品牌记录为检查前已有声明，本轮未重新证明其浏览器结果。

2026-10-08 品牌同步：新素材已接入全部页面共用组件与全局图标，类型、素材哈希、12 路由 HTTP 和桌面/手机显示检查通过，无本轮品牌接入阻塞。本地预览及 HTTP 检查曾受 Windows 沙箱路径/连接权限限制，经批准重跑后完成；未部署公网，线上更新仍需后续发布。本次不解除下列真机、资金与部署验收阻塞。见原始品牌报告（未随源码提交，历史检查声明尚需补证；断链已移除）。

2026-10-07 新增记录；不恢复此前已归档的历史排期。对应 [赛道/奖项核对](contest/track-fit.md) 和 [验收表](acceptance.md)。

| 项目 | 状态与影响 | 下一步 / 负责人建议 |
| --- | --- | --- |
| 无缓存恢复必须手填地址 | 本轮代码已修复；Mera/SIWE/ACL 本地回归通过；不等于真机验收 | C/D/E 在稳定 HTTPS 与两类真实设备验证同址及原租约访问 |
| Mera 单次入门提示 | SDK 0.2.0 存在额外认证回退；不得保证所有设备一次提示 | C/E 记录真实系统提示数；A 核对当前奖项原文 |
| Monad 完整押金闭环 | 已有历史部署/入金，未存证完整公网 850/150 与 900/100 领取 | B/C/E 实跑 DEMO_SHORT，由各角色本人确认并核对回执/余额 |
| 所选部署环境 | 本机 PostgreSQL/ClamAV 历史验证不代表公众环境 ACL/TLS/Worker 已验收 | D/E 选定环境后执行已有部署验收命令并留证 |
| 成片、采用、独立复核 | 已有脚本与本地测试；无公开成片、真实用户采用、第二人复现与独立资金审查证据 | A/C/E/B 分别补视频、首次五分钟研究、独立复现及合格资金评审 |
| 当前正式规则与成员披露 | 公开页和历史 PDF 不能替代登录后台细则；其他成员工具/素材/人工审核需本人确认 | A 汇总原文、各成员确认及投稿回执 |
2026-10-11：Azure 学生订阅下的 East Asia VM 已创建并正在运行，应用和扫描器镜像构建成功；API 转发改动通过本地构建，尚未发布。数据库凭据迁入、会话配置与 TCP 80/443 公网规则待明确确认；运行时健康、Worker、HTTPS、前端/链上闭环仍未验收。SSH 私钥下载文件未同步，不能交付下载链接。见[服务器准备记录](../tests/reports/2026-10-11-azure-server-prep.md)。

2026-10-11 deployed backend follow-up: canonical Vercel API health now returns 200 with database/storage/quarantine/scanner/RPC true; unauthenticated session correctly returns 401. Azure migration, TLS and EICAR scanner checks passed. Chain synchronization range fixed, but history catch-up and user-owned wallet/device funds flows remain incomplete. No AT/TS or FR/SC status is promoted. See [live deployment evidence](../tests/reports/2026-10-11-azure-live-backend.md).

2026-10-12 live follow-up: canonical API health remains all true; factory checkpoint 70,256,114 is 18 blocks behind observed head 70,256,132; Tenant independently reads 1,000 MockUSD. Historical indexing is essentially caught up at this observation. Zero stored service profiles, MetaMask review and complete public wallet/funds acceptance remain unresolved. No FR/SC/AT/TS is promoted. See [live status](../tests/reports/2026-10-12-live-status.md).

2026-10-12 service follow-up: a new DEMO_SHORT profile was registered and accepted by both user-owned resolver wallets, independently checked against its original manifest/salt, and imported through the existing CLI. Backend eligibility passed; authenticated canonical API returned one service containing this profile. Missing service configuration is resolved. MetaMask review and public device/funds acceptance remain unresolved; no requirement is promoted. See [service import evidence](../tests/reports/2026-10-12-service-profile-import.md).

2026-10-12 lease preparation: two disposable API signers completed new-service draft/invite/join/prepare checks and official testnet createLease simulation without broadcasting. Service cap, pre-join ACL, incomplete/stale preparation and landlord-only authorization checks passed; both sessions logged out. Actual user browser/funds acceptance remains pending. See [preparation evidence](../tests/reports/2026-10-12-live-lease-preparation.md); no requirement is promoted.

2026-10-12 targeted security follow-up: dependency patches prepared; production audit reports zero known advisories, typecheck/build and 13 auth/client tests pass. Production is not upgraded and MetaMask classification remains unexplained. No requirement status is promoted. See [targeted review](../tests/reports/2026-10-12-targeted-security-review.md).
