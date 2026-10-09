# 最终演示录制就绪检查

日期：2026-10-08（北京时间）。检查基线：`e4a96d9565fd2f9783750a76ce441be1cb8405f4`，含检查前已有的未提交品牌修改。环境：Windows / Node 24.14.0。范围为仓库、实现入口及本地回归检查，不是完整安全审计或新一次公网链上核验。

## 结论与待办

可以准备讲稿和试录，但当前证据不足以放行最终验收版。主流程已有实现和历史本地浏览器证据，不能将这些直接当成 Monad、真机或完整产品验收。

1. 当前工作区依赖不完整：Worker 的 `viem` 已在 package.json 和 pnpm-lock.yaml 声明，但本机无法解析；`apps/web/node_modules/playwright` 也不存在。需按根 README 恢复锁定的 workspace 依赖后重跑 Web、Integration 和 E2E。属于当前安装问题，尚不能据此认定合约算法错误。
2. 文档检查失败：Web README、acceptance、blocker-log、requirements-traceability 共四处引用 `2026-10-08-brand-refresh.md`，该文件不存在。应找回原始报告或重新执行检查并补真实证据，不能仅创建一个声称通过的文件。
3. `deployments/demo-short.example.json` 仍为 templateOnly=true / readyForFrontend=false，地址、服务方案、交易等为空。9 月历史快照只有创建和入金证据；本轮没有查询公网当前状态。需真实 DEMO_SHORT 方案及 R/F 接受，T/L 本人确认、入金，在网页完成 700/100/200 → 850/150 的分配与双方领取，逐笔核对回执；另用独立租约补 900/100 超时分支。
4. Mera/WebAuthn PRF 两类真实设备、稳定 HTTPS 域名上的同址恢复、原租约及材料访问、取消与会话到期尚无完整验收证据。本地替身不替代这些测试。
5. 选定演示环境的 PostgreSQL、ClamAV、私有 ACL、API 后台任务及独立 Worker 联合运行/恢复尚待验收；公网体验网站并非仓库保存的比赛条款摘录所列硬性提交项，但实际演示环境必须可用。
6. 第二人新 clone 复现、合格非作者资金复核、剩余 AT 验收、固定 release commit 仍待完成。当前已有未提交品牌修改，录像对应版本尚未冻结。
7. 邮件/短信提醒为 P1 未完成项：`apps/worker/src/notifications/index.ts` 的默认发送函数仅日志输出并返回 true；正式 main.ts 未接入该提醒循环。不能宣传真实通知已送达，但可明确不纳入本次主视频。旧 providers.ts 的 wallet TODO 不等于正式 Worker 没有交易实现：main.ts 实际使用 rpc.mjs。
8. 提交材料仍需公开且不超过 3 分钟的真实操作视频、成员及外部素材/AI 披露确认、平台规则/字段与提交回执。当前规则以仓库保存摘录为依据，本轮未独立核查赛事网站。

## 本轮命令与实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck --prefix apps/web` | Passed，退出 0 |
| `node tests/runner.mjs integration` | 5 passed / 4 failed / 0 skipped，退出 1；IT-03—06 均因 Worker 无法导入 viem 而失败；见 [JSON](integration-2026-10-08.json) |
| `node scripts/check-scaffold.mjs` | Failed，退出 1；上述四个报告链接失效 |
| `git diff --check` | Passed；仅已有文件的 LF/CRLF 提示 |
| `npm test --prefix apps/web`（沙箱内） | 70 passed / 6 failed / 0 skipped，退出 1；包括 Windows realpath EPERM、本机连接/存储失败及 viem 缺失，不能全部归为业务缺陷 |
| `npm test --prefix apps/web`（获准沙箱外重跑） | 75 passed / 1 failed / 0 skipped，退出 1；文件/存储/本机连接及本地 EVM 用例通过，唯一失败为 worker-runtime.test.mjs 无法导入 viem |

沙箱外重跑消除了首次运行中另外五项失败；Worker 测试文件在导入时失败，其内部多项用例未能展开，因此当前 76 项计数不可直接与历史全量 83 项计数比较。检查记录写入后再次运行 `git diff --check` 通过；`node scripts/check-scaffold.mjs` 仍因同一四处品牌报告链接失败，未产生新的断链。

本轮未运行浏览器 E2E、完整 Foundry 套件、生产构建、真实部署验收或真机操作。10 月 7 日 Web 83 / Integration 9 / E2E 8 的全通过记录仍是历史证据，不代表本轮环境可直接复现。未修改业务代码、依赖清单或锁文件；测试 pretest 从固定 solc 重建本地生成 ABI，Git 未显示共享 ABI 变化。未签署或广播公网交易，未部署、上传或联系外部人员。

本检查仅新增证据和阻塞记录，不提升任何 FR/SC/AT/TS 为 Verified。
