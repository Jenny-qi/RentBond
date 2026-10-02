# 阻塞与待核事项

## 2026-09-30 进展与剩余门槛

- BL12：运行器对任何 skipped 退出非零；四个已有 D 权限用例及 Worker 时间单位回归可单独在 CI 运行。全量 Integration 仍有四项未实现，E2E 八项未实现；CI 全量 E2E 将明确失败，直至真实跨层用例落地。**未关闭**。
- BL13：`decideJobTrigger` 保留事件区块并单独存 UTC 到期秒，去除不存在的合约函数/完成事件触发器；只有三种可由事件推导的候选任务。真实 RPC、持久化、区块确认、任务执行/回滚/停启尚未接通。**未关闭**。
- BL15：新增 `DEMO_SHORT` 配置脚本与部署模板，**没有部署或测试网结算回执**；公众上传扫描/隔离未完成。**未关闭**。
- BL06：新增本地随机金额守恒与领取测试，不是第二人资金审查。**未关闭**。

## 2026-09-29 阶段复查补充

依据本地已合并 HEAD `0dcc55f`，PR #6/#7 已在本地历史合并。以下为当前开发/验证缺项；未另存群汇报，证据边界保留在本表。

| ID | 状态 | 复现与影响 | 负责人 / 下一步 / 关闭证据 |
| --- | --- | --- | --- |
| BL12 | Open | `node tests/runner.mjs all` 全部 16 项 skipped，仍退出 0；不能据此发布 | E；明确未验收退出策略，接入已有 D 用例并完成真实 E2E，启用 CI，保存实际执行证据 |
| BL13 | Open | Worker scheduler 将 deadline 秒数作为 triggerBlock，地址/调用尚是桩且接口与 ABI 不一致 | E/B/D；按确认区块时间和实际合约状态调度，完成持久化执行及边界/停启测试，关联 SC-12、AT29—31/47/51 |
| BL14 | Closed (current machine only) | 最初缺 solc 等依赖；npm 缓存权限失败后经允许按锁文件安装成功，Web 58项、类型检查和构建通过 | C；[Web README](../apps/web/README.md)。第二人新 clone 的 TS04 仍未完成 |
| BL15 | Open | 当前测试网租约为正常长周期，主 Demo 缺可短时复现的真实结算；公众上传扫描仍未实现 | B/C/E 交付明确 DEMO_SHORT 流程与交易证据；D 在公众上传前补扫描/隔离；A 追踪提交规则与证据 |

更新时间 2026-09-26。这里区分资料缺失与尚未开发；未完成不自动叫外部阻塞。

| ID | 状态 | 事项 | 负责人 | 关闭证据 |
| --- | --- | --- | --- | --- |
| BL01 | Closed | 分享页面无法读取 | A | 用户已提供全文和定位补充，changes 已吸收 |
| BL02 | Open | 五名成员姓名/GitHub 账号未填写 | A | team 与真实 CODEOWNERS |
| BL03 | Open | 正式人数/资格/测试网/精确截止未核对 | A | 后台规则原文、日期和截图 |
| BL04 | Not started | SDK 与运行时兼容性、锁文件 | E/C/D/B | TS01—05、dependency-matrix |
| BL05 | In progress | 合约本地状态机已有实现，40 项测试与固定构建 ABI 已准备；网页已有部分模拟交互，后端跨层接入、完整边界/独立复核与测试网验收未完成 | 各模块负责人 | AT01—52、实现 commit、测试网及独立复核证据 |
| BL06 | Open | 合约独立审查人能力待确认 | A/B/E | 明确评审人及审查记录 |
| BL07 | In progress | 2026-09-26 官方 RPC 已核实五个部署块及回执、可执行代码对比、ABI 摘要、创建/入金事件和当前资金状态；完整字节码中的编译元数据不同。仅有创建和 1,000 MockUSD 入金，无 700/100/200 结算/领取及独立复核，不得标记 TS01/02 通过或正式发布 | B/E | [链上快照](../deployments/monad-testnet-2026-09-26.chain-evidence.json)；补四账户拒签/越权、真实结算/领取、第二人复核 |

每个新增阻塞记录出现日期、复现、影响、负责人、下一步和关闭证据。不要把“文档写了”当成技术阻塞已解决。

## 2026-09-25 成员 C 检查

| ID | 状态 | 复现与影响 | 负责人 / 下一步 / 关闭证据 |
| --- | --- | --- | --- |
| BL11 | Open | 固定构建 ABI 已导出，但正式网络部署 manifest（源码、地址、区块、确认策略）仍未核验；前端不能声称真实入金或领取 | B/E → C；核验并交付部署 manifest 后接真实读写，附跨层及链上证据 |
| BL08 | Closed (D local implementation) | D 已提供 SIWE、草稿、邀请、私有材料、导出、Gas、schema 与权限测试；C 仍需把页面接入真实接口 | D → C/E；[接口](interfaces/api.md)、[交接](member-d-handoff.md)、[本地证据](../tests/reports/2026-09-26-member-d.md) |
| BL09 | In progress | Mera 0.2.0 已接地址试验并通过替身单测；无真实手机/桌面 PRF、同址恢复和签名设备证据 | C/D/E；本人在目标设备/HTTPS RP 域名完成 TS05，不能以模拟通过关闭 |
| BL10 | In progress | CHECKOUT/材料版本/交易回执、替换核对与恢复/历史/导出已接线，页面为英文；尚无本人设备和完整浏览器测试网流程证据 | C/D/E；见 [Web 实现](../apps/web/README.md)，在已核验 DEMO_SHORT 环境由角色本人完成端到端验收 |

SDK 首次安装发生 ECONNRESET，重试后成功；该下载故障已解决。未联系外部成员，未上传或部署。

## 2026-09-26 成员 D 检查

- 已生成与现有源码一致的 ABI，并通过真实本地 EVM 联调。BL11 的公网部署/确认策略仍待 B/E，不能以本地 chainId=10143 的测试替代 Monad。
- BL09 真机 PRF 与跨设备恢复仍待 C/本人设备；D 已验证 Mera 签名适配与 SIWE 同址权限恢复。
- Supabase REST 适配和默认拒绝策略已交付，本次没有开通托管项目。开发使用本地私有存储或自托管服务即可。
- 现有 EvidenceAcknowledged 事件缺少 bundleId/commitment；D 已用精确 getEvidence 读取避免误归属，B/E 后续版本评审该事件完整性。

## 2026-09-27 D 复核

D 分支已合入 main d26ddab 的 B/E 变更，修复与补充内容见 [复核报告](../tests/reports/2026-09-27-member-d-review.md)。D 分支推送不等于合并 main。PR #6 提供的公开测试网核验证据仍按其 PR 范围审查，不能推导出 Web/API/Worker 已完成公网联调。正式开放公众上传前，PRD 9.4 要求的文件扫描与隔离仍是发布阻断项；当前类型/大小/摘要及下载安全头不能替代扫描。

## 2026-10-02 Worker RPC 与事件索引复核

- RPC provider 现在对无 `result` 的响应明确报错，并拒绝无效的预期 chain ID；隔离单元测试 6/6 通过。IT-06 尚未运行真实投影故障场景。
- `apps/worker/src/indexer/loop.ts` 的 Factory topic 和 Escrow topic 仍为占位值，手写事件字段与固定 ABI 的 indexed 定义也不一致；真实日志发现/解码尚不能作为已验收能力。该文件的 BigInt 状态 JSON 持久化及重组检测也需独立修复并跑 IT-03—06。不要用 provider 单测或脚手架 CI 关闭 BL12。
