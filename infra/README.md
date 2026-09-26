# 数据库与私有存储

负责人 D，E 复核。已实现 PostgreSQL/PGlite 同源迁移、本地私有对象目录和 Supabase REST 适配。开发无需云账号；启动、队列和可选 Docker 步骤见 [D 交接](../docs/member-d-handoff.md)。

users/sessions、leases、service_profiles、lease_members、document_versions、inspections/items、claims、cases/decisions、chain_events、notifications、audit_log 见 PRD 9.2。

金额 numeric(78,0) 或整数；事件唯一键包含 chainId/txHash/logIndex；存储匿名默认拒绝，服务密钥入口仍需 ACL。
