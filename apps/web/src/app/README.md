# 页面路由规划

负责人 C；`api/` 子目录由 D 负责，本层未添加 API 实现。

已实现路由：`/` P01；`/login` P02；`/leases` P03；`/leases/new` P04；`/invite/[token]` P05；`/leases/[id]/fund` P06；`/leases/[id]` P07；`/leases/[id]/checkout` P08；`/leases/[id]/claims` P09；`/leases/[id]/cases/[caseId]` P10；`/resolver` P11；`/leases/[id]/settlement` P12。

当前页面统一由 `features/live/LivePage.tsx` 实现，使用英文界面、真实 API、固定 ABI 和确认回执。金额与交易状态不使用模拟数据；本地验证结果及公网、设备验收边界见 [Web README](../../README.md)。
