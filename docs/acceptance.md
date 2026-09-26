# 验收清单

以下保留原 PRD 15.2 的全部 AT 场景及预期。合约切片已有本地测试，跨层、测试网和独立复核仍未完成；骨架检查不计入 AT。负责人是初始分配，可在 team 确认后调整。

需求状态：Not started / In progress / Blocked / Verified。运行结果独立记 Not run / Passed / Failed。Verified 必须有固定 commit、命令、环境与证据；失败记录不可删除或改成通过。

## 前置技术试验

| ID | 试验 | 负责人 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| TS01 | 网络、四账户、错误链和拒签 | B/E | Not started | — |
| TS02 | 最小真实资金闭环与权限 | B/E | Not started | — |
| TS03 | SIWE 与私有文件越权拒绝 | D/C | In progress | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| TS04 | 独立成员从新 clone 完整运行 | E | Not started | — |
| TS05 | passkey 同地址恢复、费用、取消不执行 | C/D | In progress | [C local slice](../tests/reports/2026-09-25-member-c.md) (SDK unit only; real device Not run); [D local slice](../tests/reports/2026-09-26-member-d.md) |

## 完整业务用例

| ID | 场景（PRD 原文） | 预期（PRD 原文） | owner | status | lastResult | commit / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| AT01 | R/F 服务方案未授权、已撤销或不覆盖本租约时，T 尝试 fund。 | 拒绝，余额和状态不变。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT02 | T/L 已接受且服务有效，T 精确存入 D；再次存入。 | 第一次成功；第二次拒绝，不多收押金。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT03 | approve 成功但 fund 未签或失败。 | 显示未存入；可重试／撤销授权。 | C/D/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT04 | 无关地址尝试 submitClaims、proposeDecision、withdraw。 | 全部被合约拒绝。 | B/E | Not started | Not run | — |
| AT05 | 租约自然到期但未交接。 | 没有自动全额退款。 | B/E | Not started | Not run | — |
| AT06 | 双方确认交接。 | 从确认时刻启动固定申索窗口。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT07 | 提前交接请求无人回应。 | 可开 CHECKOUT，不立即退钱；到 leaseEndAt 可走预定申索，不被请求阻塞。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT08 | CHECKOUT 有效否定结果。 | 恢复 Active；相同资料立即再次请求被拒绝。 | B/E | Not started | Not run | — |
| AT09 | 房东未申索，窗口结束。 | closeClaims 将 D 全部分配给 T。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT10 | 房东提交超过 D 的金额或第 11 项。 | 合约拒绝整个提交，不留下半份清单。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT11 | 房东清单已提交，尝试再次提交或提高金额。 | 拒绝；追加资料不能改原金额。 | B/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT12 | 1,000 押金，申索 100＋200，认可 100、争议 200。 | 截止后 T 可领 700、L 可领 100、U=200。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT13 | 租客对 200 不回应。 | 回应截止后该金额进入处理，不自动给 L。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT14 | 房东在 closeClaims 前撤回 200。 | 截止结算时相应金额归 T，且不重复计入 D-C。 | B/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT15 | 房东在 closeClaims 后、案件创建前撤回未分配 200。 | 200 即时记入 T credit，不影响已分配款。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT16 | 主结果给争议 200 中的 50 给 L。 | 提出时不转钱；无挑战并到期后 T 增 150，L 增 50。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT17 | 在主结果窗口内挑战。 | 进入 F；原 finalizePrimary 无法生效。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT18 | 主处理人超时后才提交结果。 | 旧提交失败；可升级给 F。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT19 | F 补充材料期尚未结束就裁决。 | 拒绝；过早终结不成立。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT20 | CLAIMS 的 F 固定期限到达仍无结果。 | 进入 ExitPending；旧 credit 可领；3 天后可 finalizeTimeout，剩余争议款给 T。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT21 | 已领取 700 和 100 后，双方和解剩余 200。 | 只结算 U=200；不再分配已付 800。 | B/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT22 | 和解提出后发生其他分配，再确认旧提案。 | StaleProposal；要求重新确认。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT23 | 同一项目、同一结果、同一领取重复调用。 | 不重复分配或支付；不变量成立。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT24 | withdraw 转账失败或模拟恶意代币回调。 | 回滚并保留可领取额；重入不导致超付。 | B/E | Not started | Not run | — |
| AT25 | 外部地址直接给合约多转 1 MockUSD。 | 已登记 D 不变，业务不能把额外转入当作新押金。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT26 | deadline-1 秒、deadline、deadline+1 秒分别操作。 | 提交和推进权限符合统一边界，无双重合法路径。 | B/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT27 | 用另一个租约用户读取照片、导出包和处理页。 | 返回 403 或不暴露资源的等价响应。 | D/E | In progress | Passed (D local slice) | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT28 | 重放 SIWE nonce、替换域、换链或过期。 | 登录失败；不建立新会话。 | D/E | In progress | Passed (D local slice) | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT29 | 链上成功后数据库暂时故障，随后重放事件。 | 状态补齐且只有一条有效金额记录。 | E（B/C/D协作） | Not started | Not run | — |
| AT30 | RPC 中断／主备网络不一致。 | 显示异常并禁用写入，不把读取失败当余额零。 | E（B/C/D协作） | Not started | Not run | — |
| AT31 | Worker 停止后，用户自行执行到期推进。 | 在满足前提时成功；Worker 恢复不重复分配。 | E（B/C/D协作） | Not started | Not run | — |
| AT32 | 暂停 Factory 新建。 | 无法新建；既有租约仍能正常领取。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT33 | 改写原文件或私有条款后核验。 | 承诺值不匹配，界面明确提示，不能继续冒称已确认原版。 | D/E | In progress | Passed (D local slice) | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT34 | 从全新 clone 启动并执行核心流程。 | README 可复现，无未记录的手工数据库改值。 | E（B/C/D协作） | Not started | Not run | — |
| AT35 | 对同一材料版本重复上链、回应不存在版本或替换哈希。 | 拒绝；新版本不继承旧认可，私有文件被改动可核查。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT36 | 裁决向量缺项、重复 ID、金额越界或精度错误。 | 整个结果拒绝，无部分分配，资金守恒。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT37 | R/F 对同一服务方案各接受一次，随后创建第二份合格租约。 | 双方逐约确认后即可入金，不要求 R/F 再接受该租约。 | B/E | Not started | Not run | — |
| AT38 | 服务在租约创建后、fund 前被撤销或过期。 | fund 拒绝且不转币；重新选择有效方案并重建。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT39 | 已入金后关闭服务方案或建立含新 R/F 的版本。 | 原租约 R/F、期限、分配与领取保持原快照。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT40 | 尝试对超额度、错误资产或不同规则的租约套用服务授权。 | 创建或 fund 拒绝；不能用页面绕过服务范围。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT41 | 普通新用户从邀请创建账户、确认与入金，取消一次资金确认。 | 无需扩展、购买 MON 或设置 Gas；取消没有后续隐式扣款。 | C/D/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT42 | 重新登录、换兼容设备恢复；另建 passkey 产生不同地址。 | 恢复原地址才显示原角色；不同地址不能假装恢复或访问私有材料。 | C/D/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT43 | 测试补给中断、余额不足、重复补给与限额超出。 | 不代签用户；展示真实失败，可受限重试；押金不被用作 Gas。 | C/D/E | In progress | Passed (D local slice) | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT44 | 未升级时 F 请求读取争议材料；升级后读取。 | 前者拒绝，后者仅限该案；失效链接和跨案访问仍被拒绝。 | D/E | In progress | Passed (D local slice) | [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT45 | Active 无人交接，直到 leaseEndAt 后才启动。 | 申索与回应按固定日期计算；在截止前可提交清单，迟调用不能延后。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT46 | T 已领 700、L 已领 100、争议 200；R/F 均超时。 | timeoutAt 前禁止释放；到期 200 给 T；最终 T900/L100；重复调用不重复分配。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT47 | Worker 全程停止，直到 hardEndAt 后才执行。 | 固定受益人金额守恒、U 归零；延迟开案/升级不增加期限，第三方可触发。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT48 | 已认可扣款或未被挑战且已成熟主结果，调用 expireEscrow。 | 先尊重及时成立的有效金额权利，再退剩余 U；已挑战结果不复活。 | B/E | In progress | Not run | [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT49 | 双方和解、R/F 旧结果、退出交易交错。 | 每种顺序最多分配一次；退出后旧提案/案件失效；所有 credit 保留。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md); [C local slice](../tests/reports/2026-09-25-member-c.md) |
| AT50 | 请求提前交接且服务失效；再次请求、拖到约定到期。 | 不会因提前请求超时立即退全部；leaseEndAt 与 hardEndAt 不变，不可无限循环延期。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |
| AT51 | 停止主站、API、数据库、Worker 和官方 Gas 补给；使用独立工具。 | 从原账户/链上记录恢复；第三方提供费用并通过 withdrawFor 向原受益人支付；无后台权限依赖。若同账户恢复不可行则验收失败。 | E（B/C/D协作） | In progress | Passed (local contract slice only) | [local report](../tests/reports/2026-09-21-contracts-local.md); [D local slice](../tests/reports/2026-09-26-member-d.md) |
| AT52 | 核对双方确认的自然语言条款、参数和部署合约。 | UTC 日期、timeoutPolicy、hardEndAt、条款哈希一致；禁止创建无最终期限或服务范围不匹配的租约。 | B/E | In progress | Passed (local contract slice) | [local report](../tests/reports/2026-09-21-contracts-local.md) |

## 证据记录格式

2026-09-25 C 补充：表中 C local slice 仅说明已有前端实现/回归测试或 SDK 替身试验，不改变该 AT 的完整运行结果。该日期的 TS05、AT41/42 真实设备/恢复/SIWE/Gas 场景仍 Not run。具体测试覆盖及未覆盖范围见 [C 本地报告](../tests/reports/2026-09-25-member-c.md)。

2026-09-26 D 补充：D local slice 已执行真实签名、持久数据库、文件 ACL、篡改拒绝及本地 EVM Gas/资金集成。TS05/AT41/42 尚未完成真实设备恢复和完整前端操作，AT51 未模拟全站停运恢复。所有相关需求保留 In progress，等待独立复核和适用的公开测试网验收；见 [D 报告](../tests/reports/2026-09-26-member-d.md)。

每次运行记录：日期、操作者、代码 commit、网络/工具版本、命令、实际输出、交易/截图或脱敏日志路径、Passed/Failed/Not run、剩余问题。推荐把报告放 tests/reports/（不含敏感材料），然后把链接填入表格。

## 发布门槛

全部 P0、关键权限/金额/边界/恢复通过，第二人复核；没有执行的不写通过。测试网交易、ABI、条款与 hardEndAt 对齐；主 Demo 三角色不能豁免备用与异常验收。
