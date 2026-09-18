# 模块接口交接

下列为待实现的契约，不是已有 HTTP 服务或 ABI。完整语义以 PRD 9、11、12 章为准。

- [共享数据与金额](shared.md)：E 维护，B/C/D 共同消费。
- [API 与权限](api.md)：D 提供，C/E 消费。
- [合约与事件](contracts.md)：B 提供，C/D/E 消费。

变更先在 Issue 写出旧/新字段、版本兼容、消费者和影响的验收。Root lockfile、ABI、迁移由各负责人集中维护，避免各端临时创造不同字段。
