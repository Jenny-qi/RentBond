# 验收清单

## 2026-10-13 Mera transaction signing

Fixed loss of the local Mera signer when a simulated contract request overrides
the wallet client account. Ten focused tests and type checking passed; the
production frontend still requires deployment and a real confirmed transaction.
This does not mark the Mera public-chain flow Verified. See the
[regression report](../tests/reports/2026-10-13-mera-signing-fix.md).

## 当前状态（2026-10-12）

线上部署（rentbond.vercel.app）：
- 前端：Vercel HTTPS ✓
- 后端 API + Worker：Azure ✓
- 数据库、存储、隔离区、病毒扫描、RPC 五项健康检查全部通过 ✓
- 正式 API 已验证：SIWE 登录、权限隔离、文件上传/扫描/导出/下载、退出登录 ✓
- 服务方案已注册并导入（DEMO_SHORT）✓
- Tenant 账户持有 1,000 MockUSD，四个角色均有测试 MON ✓

本地工作区：
- 类型检查：0 错误
- Integration：9 passed / 0 failed / 0 skipped
- E2E：8 项本地 Chromium 场景通过
- 生产构建：成功

## 待完成

以下项目需真实网页钱包操作完成，当前状态为 pending，不是失败：

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| MetaMask 安全分类 | pending | 显示"Malicious"警告，原因未查明，已提交人工复核 |
| 网页创建租约 → 领取完整公网流程 | pending | 钱包签名因 MetaMask 警告暂停，非流程失败 |
| Worker 自动推进交易 | pending | WORKER_EXECUTE=false，演示前需确认推进方式 |
| 3 分钟演示视频 | pending | — |
| 第二人独立复现 | pending | — |
| 独立资金审查 | pending | — |

## 线上验证报告

生产仓实时验证记录（保留在 `tests/reports/`）：
- `2026-10-12-live-status.md` — 线上健康状态
- `2026-10-12-service-profile-import.md` — 服务方案导入核验
- `2026-10-12-live-lease-preparation.md` — 租约创建预检
- `2026-10-12-targeted-security-review.md` — 依赖安全更新
- `2026-10-11-azure-live-backend.md` — Azure 后端上线确认
- `2026-10-11-public-api-acceptance.md` — 公网 API 切片验证
- `2026-10-11-lease-readiness.md` — 创建前置条件确认

## 赛道与奖项

参赛赛道：**Consumer Products & Payments**
赞助商候选：**Best Mera-Powered UX on Monad / Monad Foundation**

完整奖项证据要求见 [track-fit.md](contest/track-fit.md)。

## 逐条索引与历史证据

以下表格保留文档整理前的逐条追踪记录（基线 `d325de0`），用于定位要求、负责人和历史证据。状态、commit 和测试结果均属于该历史基线，不表示当前版本或线上环境已完成验收；最新进展以上方记录及对应的新报告为准。历史相对链接改为固定提交链接，避免已归档报告产生断链。

### TS index

| ID | 试验 | 负责人 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| TS01 | 网络、四账户、错误链和拒签 | B/E | In progress | [链 ID 与角色只读快照](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/deployments/monad-testnet-2026-09-26.chain-evidence.json)；拒签/错误链/越权 Not run |
| TS02 | 最小真实资金闭环与权限 | B/E | In progress | [创建与入金快照](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/deployments/monad-testnet-2026-09-26.chain-evidence.json)；分配/领取 Not run |
| TS03 | SIWE 与私有文件越权拒绝 | D/C | In progress | [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| TS04 | 独立成员从新 clone 完整运行 | E | In progress | `node scripts/ts04-clone-verify.mjs` 仅检查文件、环境变量名和命令文档；未实际新 clone、安装、启动链/服务或跑完整命令，独立复现 Not run |
| TS05 | passkey 同地址恢复、费用、取消不执行 | C/D | In progress | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) (SDK unit only; real device Not run); [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |

### AT index

| ID | 场景（PRD 原文） | 预期（PRD 原文） | owner | status | lastResult | commit / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| AT01 | R/F 服务方案未授权、已撤销或不覆盖本租约时，T 尝试 fund。 | 拒绝，余额和状态不变。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT02 | T/L 已接受且服务有效，T 精确存入 D；再次存入。 | 第一次成功；第二次拒绝，不多收押金。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT03 | approve 成功但 fund 未签或失败。 | 显示未存入；可重试／撤销授权。 | C/D/E | In progress | Passed (local browser slice) | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT04 | 无关地址尝试 submitClaims、proposeDecision、withdraw。 | 全部被合约拒绝。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-23-member-b-contracts-local.md) |
| AT05 | 租约自然到期但未交接。 | 没有自动全额退款。 | B/E | Not started | Not run | — |
| AT06 | 双方确认交接。 | 从确认时刻启动固定申索窗口。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT07 | 提前交接请求无人回应。 | 可开 CHECKOUT，不立即退钱；到 leaseEndAt 可走预定申索，不被请求阻塞。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT08 | CHECKOUT 有效否定结果。 | 恢复 Active；相同资料立即再次请求被拒绝。 | B/E | Not started | Not run | — |
| AT09 | 房东未申索，窗口结束。 | closeClaims 将 D 全部分配给 T。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT10 | 房东提交超过 D 的金额或第 11 项。 | 合约拒绝整个提交，不留下半份清单。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT11 | 房东清单已提交，尝试再次提交或提高金额。 | 拒绝；追加资料不能改原金额。 | B/E | In progress | Not run | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT12 | 1,000 押金，申索 100＋200，认可 100、争议 200。 | 截止后 T 可领 700、L 可领 100、U=200。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT13 | 租客对 200 不回应。 | 回应截止后该金额进入处理，不自动给 L。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT14 | 房东在 closeClaims 前撤回 200。 | 截止结算时相应金额归 T，且不重复计入 D-C。 | B/E | In progress | Not run | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT15 | 房东在 closeClaims 后、案件创建前撤回未分配 200。 | 200 即时记入 T credit，不影响已分配款。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT16 | 主结果给争议 200 中的 50 给 L。 | 提出时不转钱；无挑战并到期后 T 增 150，L 增 50。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT17 | 在主结果窗口内挑战。 | 进入 F；原 finalizePrimary 无法生效。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT18 | 主处理人超时后才提交结果。 | 旧提交失败；可升级给 F。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT19 | F 补充材料期尚未结束就裁决。 | 拒绝；过早终结不成立。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT20 | CLAIMS 的 F 固定期限到达仍无结果。 | 进入 ExitPending；旧 credit 可领；3 天后可 finalizeTimeout，剩余争议款给 T。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT21 | 已领取 700 和 100 后，双方和解剩余 200。 | 只结算 U=200；不再分配已付 800。 | B/E | In progress | Not run | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT22 | 和解提出后发生其他分配，再确认旧提案。 | StaleProposal；要求重新确认。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT23 | 同一项目、同一结果、同一领取重复调用。 | 不重复分配或支付；不变量成立。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT24 | withdraw 转账失败或模拟恶意代币回调。 | 回滚并保留可领取额；重入不导致超付。 | B/E | Not started | Passed (local browser slice) | —; [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT25 | 外部地址直接给合约多转 1 MockUSD。 | 已登记 D 不变，业务不能把额外转入当作新押金。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT26 | deadline-1 秒、deadline、deadline+1 秒分别操作。 | 提交和推进权限符合统一边界，无双重合法路径。 | B/E | In progress | Passed (local browser slice) | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT27 | 用另一个租约用户读取照片、导出包和处理页。 | 返回 403 或不暴露资源的等价响应。 | D/E | In progress | Passed (D local slice) | [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT28 | 重放 SIWE nonce、替换域、换链或过期。 | 登录失败；不建立新会话。 | D/E | In progress | Passed (D local slice) | [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT29 | 链上成功后数据库暂时故障，随后重放事件。 | 状态补齐且只有一条有效金额记录。 | E（B/C/D协作） | Not started | Not run | — |
| AT30 | RPC 中断／主备网络不一致。 | 显示异常并禁用写入，不把读取失败当余额零。 | E（B/C/D协作） | Not started | Not run | — |
| AT31 | Worker 停止后，用户自行执行到期推进。 | 在满足前提时成功；Worker 恢复不重复分配。 | E（B/C/D协作） | Not started | Not run | — |
| AT32 | 暂停 Factory 新建。 | 无法新建；既有租约仍能正常领取。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT33 | 改写原文件或私有条款后核验。 | 承诺值不匹配，界面明确提示，不能继续冒称已确认原版。 | D/E | In progress | Passed (D local slice) | [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT34 | 从全新 clone 启动并执行核心流程。 | README 可复现，无未记录的手工数据库改值。 | E（B/C/D协作） | Not started | Not run | — |
| AT35 | 对同一材料版本重复上链、回应不存在版本或替换哈希。 | 拒绝；新版本不继承旧认可，私有文件被改动可核查。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT36 | 裁决向量缺项、重复 ID、金额越界或精度错误。 | 整个结果拒绝，无部分分配，资金守恒。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT37 | R/F 对同一服务方案各接受一次，随后创建第二份合格租约。 | 双方逐约确认后即可入金，不要求 R/F 再接受该租约。 | B/E | Not started | Not run | — |
| AT38 | 服务在租约创建后、fund 前被撤销或过期。 | fund 拒绝且不转币；重新选择有效方案并重建。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT39 | 已入金后关闭服务方案或建立含新 R/F 的版本。 | 原租约 R/F、期限、分配与领取保持原快照。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT40 | 尝试对超额度、错误资产或不同规则的租约套用服务授权。 | 创建或 fund 拒绝；不能用页面绕过服务范围。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT41 | 普通新用户从邀请创建账户、确认与入金，取消一次资金确认。 | 无需扩展、购买 MON 或设置 Gas；取消没有后续隐式扣款。 | C/D/E | In progress | Not run | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT42 | 重新登录、换兼容设备恢复；另建 passkey 产生不同地址。 | 恢复原地址才显示原角色；不同地址不能假装恢复或访问私有材料。 | C/D/E | In progress | Not run | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT43 | 测试补给中断、余额不足、重复补给与限额超出。 | 不代签用户；展示真实失败，可受限重试；押金不被用作 Gas。 | C/D/E | In progress | Passed (D local slice) | [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT44 | 未升级时 F 请求读取争议材料；升级后读取。 | 前者拒绝，后者仅限该案；失效链接和跨案访问仍被拒绝。 | D/E | In progress | Passed (D local slice) | [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md) |
| AT45 | Active 无人交接，直到 leaseEndAt 后才启动。 | 申索与回应按固定日期计算；在截止前可提交清单，迟调用不能延后。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT46 | T 已领 700、L 已领 100、争议 200；R/F 均超时。 | timeoutAt 前禁止释放；到期 200 给 T；最终 T900/L100；重复调用不重复分配。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT47 | Worker 全程停止，直到 hardEndAt 后才执行。 | 固定受益人金额守恒、U 归零；延迟开案/升级不增加期限，第三方可触发。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT48 | 已认可扣款或未被挑战且已成熟主结果，调用 expireEscrow。 | 先尊重及时成立的有效金额权利，再退剩余 U；已挑战结果不复活。 | B/E | In progress | Not run | [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT49 | 双方和解、R/F 旧结果、退出交易交错。 | 每种顺序最多分配一次；退出后旧提案/案件失效；所有 credit 保留。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [C local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-25-member-c.md) |
| AT50 | 请求提前交接且服务失效；再次请求、拖到约定到期。 | 不会因提前请求超时立即退全部；leaseEndAt 与 hardEndAt 不变，不可无限循环延期。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
| AT51 | 停止主站、API、数据库、Worker 和官方 Gas 补给；使用独立工具。 | 从原账户/链上记录恢复；第三方提供费用并通过 withdrawFor 向原受益人支付；无后台权限依赖。若同账户恢复不可行则验收失败。 | E（B/C/D协作） | In progress | Passed (local contract slice only) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md); [D local slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-26-member-d.md); [local browser slice](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-10-03-browser-e2e.md) |
| AT52 | 核对双方确认的自然语言条款、参数和部署合约。 | UTC 日期、timeoutPolicy、hardEndAt、条款哈希一致；禁止创建无最终期限或服务范围不匹配的租约。 | B/E | In progress | Passed (local contract slice) | [local report](https://github.com/Jenny-qi/RentBond/blob/d325de069d26b2fff950425f3339aa22c6e84047/tests/reports/2026-09-21-contracts-local.md) |
