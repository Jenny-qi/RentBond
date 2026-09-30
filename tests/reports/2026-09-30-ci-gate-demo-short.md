# 2026-09-30 增量验证（基于 main bbdd540）

## 已执行

| 命令 | 结果 | 边界 |
| --- | --- | --- |
| `npm run build:contracts` | Passed | 新 DEMO_SHORT profile 脚本编译，不代表已广播 |
| `npm run test:contracts` | Passed 41/41 | 新增 256 组随机申索/裁决金额及领取守恒；本地 EVM |
| `npm run check:contract-sizes` | Passed | DepositEscrowDeployer 23,768 B runtime，距 24,576 B 上限 808 B |
| `npm run typecheck --prefix apps/web` | Passed | 使用 web 和 shared 各自锁定依赖 |
| `npm run test --prefix apps/web` | Passed 58/58 | 包括本地 EVM 联调，不是浏览器公网 E2E |
| `node tests/runner.mjs integration --only=IT-01,IT-02,IT-07,IT-08,IT-09` | Passed 5/5 | 四个 D 权限切片和 Worker 日期单位回归 |
| `node tests/runner.mjs e2e` | Exited 1: 0 passed, 8 skipped | 预期未完成门槛，不能解读为 E2E 通过 |

完整 integration 仍有 IT-03/04/05/06 跳过。CI 的 E2E job 明确执行完整套件并保持失败，直到用真实可运行用例取代桩。测试网尚未产生 DEMO_SHORT profile、租约、700/100/200、850/150 或 900/100 的交易证据；没有第二人复核。不可将 `readyForFrontend` 置真。

脚本 `CreateDemoShortProfile.s.sol` 只准备独立时间方案；模板地址、交易、区块和 digest 均为空。实际部署后必须由 R/F/T/L 各自确认交易，并以固定源代码 commit、ABI、回执和链上状态复核。Worker 的候选 job 现在区分 confirmed event block 与 UTC dueAt；RPC 轮询、持久化、合约执行及停启恢复尚未实现。
