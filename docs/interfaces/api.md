# HTTP API 与权限交接

负责人 D；路由基线来自 PRD 12.2，以下不是已上线接口。金额变化通过钱包调用合约；后端没有“设置已付款”的接口。

| 路由 | 用途 | 权限要点 |
| --- | --- | --- |
| GET /api/auth/nonce | 登录挑战 | 限流、不缓存、绑定域及有效期 |
| POST /api/auth/verify | 验证 SIWE | 原子消费 nonce，domain/URI/chainId/time/signature |
| POST /api/auth/logout | 退出 | 撤销 session，客户端清私有缓存 |
| GET /api/leases | 租约列表 | 仅当前已验证 wallet 成员 |
| POST /api/leases/drafts | 草稿 | 房东、schema 校验 |
| PATCH /api/leases/drafts/:id | 更新草稿 | 未部署、version 并发检查 |
| POST /api/leases/:id/invites | 邀请 | 限定权限、限期 token 仅存哈希 |
| POST /api/invites/:token/claim | 租客关联身份 | 本人登录；不代替条款确认、不改已部署角色 |
| GET /api/leases/:id | 条款与投影 | 成员/限权邀请；带同步时间 |
| POST /api/documents/upload-intent | 私有上传 | 租约 ACL、类型与配额 |
| POST /api/documents/:id/submit | 固定版本 | 检查真实大小/类型/hash；不覆盖旧版 |
| GET /api/documents/:id/access | 短时链接 | 每次核对成员或案件阶段，5 分钟 |
| POST /api/claims/draft | 构建申索正文 | L，合法阶段；不修改链上金额 |
| POST /api/cases/:id/evidence | 材料版本 | T/L、材料窗口 |
| GET /api/resolver/cases | 当前可处理案件 | R/F 地址 + 阶段；F 未升级不可访问 |
| GET /api/resolver/profiles | 有效测试服务 | 正文哈希与链上有效性一致 |
| POST /api/exports | 异步导出 | 授权角色及任务文件 ACL |
| GET /api/transactions/:hash | 交易状态 | 核对网络和目标合约 |
| GET /api/health | 健康检查 | 不泄漏配置/数据库地址 |
| POST /api/test-gas/request | 受限 MON 补给 | 仅测试环境/参与者，账户租约时间配额 |

统一错误对象提案：`{ "error": { "code": "FORBIDDEN", "message": "无权访问该资料", "requestId": "…" } }`。401 未登录，403 无权限，409 状态/版本冲突，422 输入错误，429 限流，503 依赖不可用。实现前 D/C 冻结具体 schema。

会话最长 24 小时、闲置 2 小时；HttpOnly/Secure/SameSite。所有高风险请求重新校验会话与角色；服务端 service key 绕过 RLS，因此每个入口仍须 ACL。跨站写入保护与上传内容隔离由 D 补具体设计及测试。
