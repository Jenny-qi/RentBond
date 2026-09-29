# 私有 Storage 策略

负责人 D。默认拒绝匿名；按租约与案件阶段发短链接；R 主阶段、F 升级后才授权。

JPG/PNG/PDF，单文件10MB、单租约100MB；拒绝 SVG/HTML；版本不可覆盖；链接5分钟；数据保留按 PRD 9.4。

本地目录位于 RENTBOND_DATA_DIR/objects，不能放进 public。Supabase 使用 supabase.sql 建私有 bucket，并用 restrictive policy 阻止 anon/authenticated 访问该 bucket，即使项目有其他宽泛策略。service key 只存在服务器。

上传意图在事务内预留配额，15 分钟过期，PUT 检查真实字节大小、文件头和 SHA-256，submit 再验摘要。对象 key 是随机 ID，不包含文件名、地址或姓名。应用层文件仍限制 10MB；bucket 的 150MiB 上限仅给服务器产生的 ZIP 导出使用。

五分钟链接绑定申请人的登录会话，每次下载重新检查原件摘要、租约/案件权限和链上 R/F 阶段。响应强制 attachment、nosniff、sandbox 和 no-store。不对浏览器签发绕过 API 的永久或直接 bucket URL。

已 Closed 且全部领取后 90 天清原件，保留不可变摘要/审计；提前清理由双方提交请求后执行。此实现没有宣称生产恶意文件扫描或端到端加密。Supabase REST 适配有协议测试，真实托管项目需部署方另跑匿名拒绝验证。
