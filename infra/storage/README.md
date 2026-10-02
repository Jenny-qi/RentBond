# 私有 Storage 策略

负责人 D。默认拒绝匿名；按租约与案件阶段发短链接；R 主阶段、F 升级后才授权。

JPG/PNG/PDF，单文件10MB、单租约100MB；拒绝 SVG/HTML；版本不可覆盖；链接5分钟；数据保留按 PRD 9.4。

本地原件位于 RENTBOND_DATA_DIR/objects，隔离区位于 RENTBOND_DATA_DIR/quarantine，均不能放进 public 或配置静态映射。Supabase 使用 supabase.sql 建两个私有 bucket，并用 restrictive policy 阻止 anon/authenticated 访问它们，即使项目有其他宽泛策略。service key 只存在服务器。

上传意图在事务内预留配额，15 分钟过期，PUT 检查真实字节大小、文件头和 SHA-256 后仅写隔离区。ClamAV INSTREAM 扫描、摘要复验通过后才提升到原件区；submit 再验扫描状态与摘要。对象 key 是随机 ID，不包含文件名、地址或姓名。应用层文件仍限制 10MB；原件 bucket 的 150MiB 上限仅给服务器产生的 ZIP 导出使用，隔离 bucket 上限 10MiB。

五分钟链接绑定申请人的登录会话，每次下载重新检查原件摘要、租约/案件权限和链上 R/F 阶段。响应强制 attachment、nosniff、sandbox 和 no-store。不对浏览器签发绕过 API 的永久或直接 bucket URL。

已 Closed 且全部领取后 90 天清原件与隔离副本，保留不可变摘要/审计；提前清理由双方提交请求后执行。扫描失败、超时、病毒库过旧均不放行，三次耗尽需调查后重新上传。ClamAV 是扫描控制，不证明材料真实，也不是端到端加密。Supabase REST 适配有协议测试，真实托管项目需部署方另跑匿名及 authenticated 拒绝验证。

2026-10-02 选定本地 PostgreSQL + 私有目录 + ClamAV 1.5.4 完成复验，含真实 EICAR PDF 附件拒绝、干净文件、导出与跨会话 ACL。配置见 clamd.conf，命令与升级步骤见 [D 交接](../../docs/member-d-handoff.md)。clamd TCP 协议没有鉴权，只能在回环或受限的私有服务网络中使用；freshclam 需持续更新病毒库。开放公网前仍需复验实际域名、TLS、服务账户与目录权限。
