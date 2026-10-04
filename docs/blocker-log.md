# 阻塞与待核事项

2026-10-04 BL03 部分澄清：按用户提供官方条款，测试网允许，视频上限 3 分钟，截止为北京时间 2026-10-14 11:59；人数／资格／完整构建窗口仍待核。用户已选择 MIT，根 [LICENSE](../LICENSE) 已添加，项目自身许可证缺项已处理。RB-14 仍缺完整第三方许可及团队 AI 披露、公共仓库访问核查、公开视频、第三方完整复现和平台提交回执。

## 2026-10-04 提交文档整理

成员 D 交接稿、过时实施排期及建仓初始化清单已删除；有效运行内容保留在后端 README，协作要求归入 CONTRIBUTING。公开 Demo/视频、正式规则核查与现有部署/真机/独立审查缺口继续保留，不因提交材料整理关闭。

## 当前基线：PR #17 合并后的 main（2026-10-03）

源码基线 `ffe56a8c8cb7654ae0864a7d3c8e2a426b815be0`，已包含 PR #14/#15 的 Worker 与 PR #17 的浏览器测试。PR #17 的 7 项自动检查通过；本地 Integration 为 9 passed / 0 skipped、Chromium E2E 为 8 passed / 0 skipped、Web 为 79 passed。证据见 [Worker 报告](../tests/reports/2026-10-03-worker-runtime.md)、[后续复查](../tests/reports/2026-10-03-worker-followup.md)及[浏览器报告](../tests/reports/2026-10-03-browser-e2e.md)。以下按日期保留的旧状态是历史快照，以本节为当前进度。

真实 Monad DEMO_SHORT 的 700/100/200 → 850/150 和 900/100 分配/领取、Mera/WebAuthn PRF 两类真机同址恢复、所选公网 PostgreSQL/Worker/TLS/私有文件 ACL 验收、第二人新 clone 复现与独立资金审查仍待完成。CI 通过不将这些需求提升为 Verified。

### 当前剩余门槛（历史 BL 表的更新）

- BL12：本地全跳过/假成功与未实现 E2E 已解决，9 项 Integration + 8 项 E2E 均实际执行并通过；公网、真机、独立复核仍 In progress。
- BL13：主执行器已接 D 持久化接口、固定 ABI、真实本地日志与到期签名/重启；所选 PostgreSQL/Monad 部署与故障恢复演练仍 Open。
- BL15：扫描隔离已有本机 PostgreSQL/ClamAV 证据；公网 ACL、明确 DEMO_SHORT 部署及完整链上结算仍 Open。
- BL06、TS04、TS05：独立资金审查、第二人完整复现及真实设备同址恢复仍待完成。

## 2026-10-02 D main 检查与修复

- 已核实 PR #7/#12 及全部 D 提交在 main。复验发现并修复 clamd.conf 被 Windows 转成 CRLF、ClamAV 日期缺时区导致新库误判，以及回滚后原区块恢复时未签名任务仍 cancelled 的问题。Web 69 项、真实 PostgreSQL/ClamAV、HTTP 与构建通过；见 [证据](../tests/reports/2026-10-02-member-d-main-review.md)。
- D 独立实现与所选本机环境的交付检查完成。BL09/10 的真机/完整浏览器联调、BL12/13 的 E 主执行器/端到端/停运恢复、BL15 的公网主机与 DEMO_SHORT 仍需联合验收；不关闭整体阻塞。

## 2026-10-02 D 第二阶段复验

- BL08：C 主分支已经接上真实 API/ABI；本轮补扫描状态消费、保留待处理上传与账号/页面切换中止。真实 SIWE、材料、导出、Gas 的后端与本地 EVM 继续通过；完整浏览器多角色/真机同址恢复仍需 C/E 验收。
- BL13：D 已交付 migration 0003、apps/worker/src/persistence/backend.mjs、幂等/锁/持久化签名交易/原子 reorg 测试，并完成真实 PostgreSQL 多连接复验。E 原 JSON 主执行器尚未切换到该接口，真实到期签名/执行与完整停运恢复仍 Open。接入步骤见 [Worker 接口](interfaces/worker-persistence.md)。
- BL15：D 扫描/隔离实现与所选本机 PostgreSQL + ClamAV + 私有目录复验已完成；真实 EICAR PDF 被拒绝，干净文件与导出通过。公网域名/TLS/主机 ACL、可选 Supabase 托管策略，以及 B 的 DEMO_SHORT 公网闭环仍待各自验收，整体不关闭。
- BL12：实跑发现混合 passed/skipped 仍退出 0，本轮修复，并移除 CI 把退出 2 转回成功的逻辑、加入 Web 回归；总验收 5 passed / 12 skipped 现退出 2。D/Web 68 项和独立部署依赖 2 项均 0 skipped，不混算总验收；远程 CI 安装链路及完整 E2E 仍需 E 验收。
- 本机 Docker 启动失败，未以它作为本轮通过环境。改用原生 Ubuntu/WSL PostgreSQL 16.15、ClamAV 1.5.4 完成真实验证；无云部署或收费服务。详见 [证据和边界](../tests/reports/2026-10-02-member-d-stage-two.md)。
2026-10-02 复核：`main` 的 CI 曾把 E2E 八项全部 skipped（退出码 2）转为成功，混合通过/跳过也被运行器当作成功。门槛修复已另提 PR；实际 E2E 仍未执行，BL12 保持 Open。TS04 的现有脚本仅作结构检查，不能证明独立成员新 clone 已启动并跑通；验收状态改回 In progress。

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
| BL08 | Closed (D local implementation) | D 已提供 SIWE、草稿、邀请、私有材料、导出、Gas、schema 与权限测试；C 仍需把页面接入真实接口 | D → C/E；[接口](interfaces/api.md)、[后端运行说明](../apps/web/src/server/README.md)、[本地证据](../tests/reports/2026-09-26-member-d.md) |
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

## 2026-10-03 Worker runtime evidence

RB-12 now has canonical ABI event discovery, D database synchronization, persisted signed public deadline execution and restart recovery. IT-01–IT-09 passed locally with no skips. See [runtime report](../tests/reports/2026-10-03-worker-runtime.md). This does not mark ATs Verified: Monad full allocation/withdrawal, real PostgreSQL Worker deployment, eight browser E2E scenarios, independent reproduction and nonauthor funds review remain required.

### Worker follow-up review (2026-10-03)

PR #14 is merged into main f843b46. Its implementation CI checks passed; browser E2E still fails as incomplete. Follow-up fixes remove stale health validation/URL logging and restrict Worker networks/intervals; local runtime tests now exercise all eight public action types. See [follow-up report](../tests/reports/2026-10-03-worker-followup.md). No AT is promoted to Verified without independent and deployment evidence.

## 2026-10-03 local browser E2E (Issue #16)

Eight executable Chromium scenarios now cover real page → HTTP API → local EVM funds flows, replacing skipped placeholders without changing the runner's fail-on-skip policy. 700/100/200, final 850/150, timeout 900/100, cancel/reject, same-address external-wallet reauthentication, duplicate withdrawal and local full-service shutdown were executed. See [browser report](../tests/reports/2026-10-03-browser-e2e.md). FR-15–21/24/31–32, SC-06/07/09/12/13 and AT12/16/23/24/26/41/42/51 gain local evidence slices only.

AT41/42/51 and TS05 remain In progress: the EIP-1193 wallet and clean scanner are test substitutes; real Mera/WebAuthn PRF, two-device recovery, public Monad allocation/withdrawal, deployed PostgreSQL and independent funds/reproduction review are not certified. No requirement is promoted to Verified. The previous skipped E2E blocker is addressed by runnable local tests; deployment/device acceptance blockers remain.

2026-10-04 品牌接入：团队彩色 Logo 已用于导航，账户区重复图标已按用户要求移除，浏览器图标保留；素材来源已记录。仅完成显示接入，不关闭真实设备、测试网或发布验收缺项。
