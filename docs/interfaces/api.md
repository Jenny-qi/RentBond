# HTTP API 与权限交接

负责人 D；PRD 12.2 的以下路由已实现并在本地测试，尚未公开部署。金额变化通过钱包调用合约；后端没有“设置已付款”的接口。入口位于 apps/web/src/app/api/[...path]/route.ts，运行时 schema 在 server/schemas.ts，公共 DTO 在 packages/shared/src/schemas/backend.ts。

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

统一错误对象：`{ "error": { "code": "FORBIDDEN", "message": "You cannot access this lease.", "requestId": "uuid", "retryable": false } }`。401 未登录，403 无权限，409 状态/版本冲突，410 已清理，413 请求超限，415 内容类型不符，422 输入错误，429 限流，503 依赖不可用。不返回密钥、原始 RPC 异常或连接信息。

会话最长 24 小时、闲置 2 小时；HttpOnly、SameSite=Strict，HTTPS 使用 Secure 和 __Host- 前缀。服务端核对精确 Origin，拒绝跨站写入；仅 localhost 开发允许 HTTP。所有高风险请求重新校验会话与角色；service key 绕过 RLS，因此每个入口仍执行 ACL。

## 冻结的请求约定

- 登录：GET nonce 返回 nonce/domain/uri/chainId/statement/issuedAt/expirationTime；客户端加 address 和 version=1 签 SIWE。POST verify 为 {message,signature}，GET /api/auth/session 返回 {wallet,expiresAt}。nonce 绑定浏览器 Cookie、有效五分钟，钱包签名不会授权交易。
- 所有普通 POST 命令都需要 Idempotency-Key（8—128 位字母、数字、下划线或连字符），同键同内容返回原结果，同键不同内容 409。auth/verify 和 auth/logout 不需要此头。POST/PATCH 使用 application/json；PUT 上传是原始字节。
- 草稿：{title,termsText,depositAmount,leaseStartAt,leaseEndAt,acceptDeadline,tenant?,serviceProfileId?}。金额为最小单位十进制字符串，日期为 UTC 秒。返回 {id,version,terms,salt,commitment}。PATCH 用同一字段的子集加 version；不接受 funded/status/role 字段。
- 邀请：{wallet?,expiresInSeconds?}，返回 token/url/leaseId/expiresAt。wallet 可省略用于新账户；GET /api/invites/:token 只给有限预览。POST claim 必须 {confirm:true}，原子关联本人地址，不等于签约。
- 部署准备：POST /api/leases/drafts/:id/prepare，{version}。核验服务、绑定 T/L 和期限后永久冻结该草稿，返回 createLease 的钱包参数。若需改条款，另建草稿。POST /api/leases/:id/deployment 为 {transactionHash}，只接受配置 Factory 的已确认创建事件并逐字段核对。
- 租约列表：GET /api/leases?limit=20&cursor=UUID，最多 50，返回 {items,nextCursor}。GET 租约返回条款、版本、材料、可见申索/声明、案件、真实投影和 lastSyncedAt；首次未部署时 projection 为 null。

## 材料与私有正文

上传意图：

```json
{"leaseId":"UUID","purpose":"move-in","mime":"image/png","size":1234,"sha256":"64位小写十六进制"}
```

可选 documentId 创建同一作者的新版本；案件用途必须 purpose=case 加 caseId。返回 {documentId,version,uploadId,expiresAt,method:"PUT",uploadUrl}。PUT 完成后 POST /api/documents/:id/submit，{uploadId}。下载 GET /api/documents/:id/access?version=1&caseId=UUID（caseId 按权限场景提供），返回 {url,expiresAt}。url 是会话绑定的 /api/files/:token，不能转发给另一会话使用。

POST /api/inspections 与 POST /api/cases/:id/evidence：

```json
{"leaseId":"UUID","stage":"move-in","items":[{"roomKey":"kitchen","description":"Recorded condition","documents":[{"documentId":"UUID","version":1}]}]}
```

stage 是 move-in/repair/move-out/case；案件 endpoint 使用 case。可加 bundleId 创建递增新版本。返回私有 manifest、salt、commitment 和 recordEvidence 钱包参数；已保存不等于已上链。读取响应的 onChain/acknowledged/agreed 通过精确 getEvidence 查询，不猜测缺少 bundleId 的合约事件。

POST /api/claims/draft 为 {leaseId,items:[{category,amount,reason,clause,documents,noEvidenceReason?}]}。类别为 cleaning/damage/unpaid-rent/utilities/other，理由 20—2000 字，1—10 项，总额不超 D，0.01 MockUSD 步长。documents 使用精确版本引用；无文件必须说明依据。返回每项正文及独立加盐承诺和 submitClaims 参数。

POST /api/leases/:id/statements 保存不可覆盖的私有声明：

| kind | 其他字段 | 钱包动作 |
| --- | --- | --- |
| claim-response | claimId、accept、reason | respondClaim |
| checkout | actualAt、reason、documents（至少一份） | requestCheckout |
| challenge | reason、documents | challenge |
| settlement | tenantShare、landlordShare、validUntil、reason | proposeSettlement，附当前 revision |

GET /api/cases/:id 返回当前授权案件。POST /api/cases/:id/decisions 仅 R/F 在合法窗口调用：{reason,documents,reasons:[{claimId,landlordAmount,reason}],checkoutApproved?}。CHECKOUT 必须空金额向量与 boolean 结果；CLAIMS 向量必须完整按序覆盖未分配项目。返回对应 propose/resolve 钱包参数。尚未上链的声明仅作者可见；正式记录通过事件或链上申索承诺匹配后共享。

## 任务、链接与配置

POST exports 为 {leaseId,caseId?}，返回 202 {id,state,statusUrl}。R/F 必须给授权 caseId，不能导出整个租约。GET /api/exports/:id 查看状态；GET /api/exports/:id/access 在 ready 时签发五分钟会话链接。

POST /api/test-gas/request 为 {leaseId}，返回 202 {id,state,amount,statusUrl}；GET /api/test-gas/requests/:id 仅本人读取。受限的测试组织者可为已关联且冻结的草稿补给部署 Gas，普通任意草稿不具备资格。其他补给必须验证真实部署租约。全部受账户/租约/全局/时间配额限制。prepared/broadcast 是等待状态；只有成功 receipt 满足确认策略才是 confirmed。

POST /api/leases/:id/cleanup-request 为 {confirm:true}。返回 requested:true、deleted:false；双方都请求后由维护命令清原件，普通用户没有单方面删除对方材料的接口。

更多运行参数、E 的同步与队列接口见 [D 交接](../member-d-handoff.md)。金额真相始终来自合约；C 仍负责每次签名的明确确认和真实页面接线。
