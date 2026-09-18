# GitHub 初始化清单

负责人 A；E 协助配置。本地仅提供文件，没有创建仓库、邀请或远端设置。

1. 创建空仓库并推送本项目，开发期是否私有由团队选择；比赛访问按正式规则。
2. 邀请五名成员，填写 team.md 的真实账号。不要共享一个 GitHub 身份。
3. 复制 `.github/CODEOWNERS.example` 为 `.github/CODEOWNERS`，替换全部账号，确认仓库内有相应写权限。
4. 为 main 设置适用的分支保护/规则集：通过 PR、至少一位非作者批准、讨论已解决、CI 必须通过。启用方式和可用功能以账户实际页面为准。
5. 当前状态检查为 `scaffold`；后续 RB-02/13 实现业务 CI 后加入对应真实检查。不要将骨架绿色视为完整发布门槛。
6. 创建看板列 Backlog / Ready / In progress / In review / Blocked / Done；复制 backlog.md 的 RB-01—14 为 Issue，填写负责人和依赖。
7. 标签建议 P0/P1、area:product、area:contracts、area:frontend、area:backend、area:qa、blocked。Issue 关联 PR 和里程碑。
8. 测试网部署凭据放受控环境；PR CI 不注入私钥，不使用 `pull_request_target` 运行不可信 PR 代码。
9. 首次 release 附源码 commit、部署记录、AT 报告、Demo、已知限制和第三方许可。许可证由团队决定，当前不默认授予开源许可。

金额/权限变更仍须具备能力的第二人审查，单纯 CODEOWNERS 规则不能证明评审质量。
