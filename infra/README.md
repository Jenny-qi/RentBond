# 数据库与私有存储

负责人 D，E 验证可复现。目标 PostgreSQL + Supabase 私有 Storage，容器及版本待 RB-02/08 实测。

users/sessions、leases、service_profiles、lease_members、document_versions、inspections/items、claims、cases/decisions、chain_events、notifications、audit_log 见 PRD 9.2。

金额 numeric(78,0) 或整数；事件唯一键包含 chainId/txHash/logIndex；存储匿名默认拒绝，服务密钥入口仍需 ACL。

