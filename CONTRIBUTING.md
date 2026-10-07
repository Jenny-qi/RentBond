# 协作规范

先读 [分工](docs/team.md)、[MVP](docs/MVP-SPEC.md)、[工程 PRD](docs/PRD.md)。当前仓库已有合约、Web/API、Worker 与本地跨层测试；公网、真机和独立复核尚未验收，最新状态见 README。

## 开发步骤

1. 从 [PRD 第 21.3 节任务清单](docs/PRD.md) 建 GitHub Issue，写负责人、依赖、FR/SC/AT、输入输出和允许改动目录。
2. 从最新 main 开分支，例如 `feat/RB-05-claim-settlement`、`fix/RB-08-session-replay`、`docs/RB-01-positioning`。
3. 保持 PR 单一目的；金额/权限/期限变更先写 ADR，由 A 确认范围、B 确认规则，调整验收。
4. 提交前运行当前可用检查；尚未实现或未运行的测试明确写出。不要把占位脚本失败改为假成功。
5. 发 PR，按模板填写测试命令、实际结果、截图或交易证据、追踪表和迁移影响。至少一位非作者审阅；资金与权限需有能力的评审人。
6. CI 通过、意见解决后合并；更新 Issue、需求追踪和对应模块 README，删除已合并的远端功能分支可由团队自行操作。

建议使用 `feat:`、`fix:`、`test:`、`docs:`、`chore:` 提交前缀，附 RB 编号。不直接在 main 开发，不把别人分支上的功能复制进自己的 PR。

## PR 完成定义

- 范围与 Issue 一致；实现和测试位置已填入追踪表。
- 金额采用整数，API 用十进制字符串，不写浮点金额。
- 所有负面路径与截止边界按相关 AT 覆盖，未运行的明确标记。
- 错误显示、私有权限和跨账号清理不能只靠 UI 隐藏按钮。
- 依赖、环境变量、迁移、ABI 或启动命令变化同步文档。
- 没有密钥、真实租约、真实照片或虚假链上记录。

## 测试状态

需求状态仅为 `Not started`、`In progress`、`Blocked`、`Verified`。单次测试运行结果另记 `Not run`、`Passed`、`Failed`，失败不应伪装成未开始。`Verified` 必须有 commit、命令和可检查证据，见 [acceptance](docs/acceptance.md)。

当前 CI 已运行环境、骨架、TypeScript、合约、Web/权限/Integration 和 Chromium E2E 检查。PR #17 的 7 项检查均通过，E2E 8 passed / 0 skipped；CI 不替代公网、真机或非作者审阅，分支保护仍由团队按实际规则配置。

## 仓库与提交维护

填写 docs/team.md 的真实成员账号，将 .github/CODEOWNERS.example 替换为真实 CODEOWNERS，并按实际账户配置 main 的 PR 审阅与 CI 保护。测试网私钥不得进入仓库或 PR CI，不使用 pull_request_target 运行不可信代码。正式 release 附固定源码 commit、部署记录、验收结果、Demo、已知限制和第三方许可。
