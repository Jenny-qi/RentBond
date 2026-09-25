# 前端功能

负责人 C。按 `account`、`leases`、`tx` 划分（claims/cases/settlement 页面消费同一租约状态）。

账户恢复验证同一地址；换账户清会话与未提交表单。金额展示使用 6 位 MockUSD 与守恒检查。链上读写在 ABI 交接前不调用真实合约。
