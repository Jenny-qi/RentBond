# 开发脚本

E 主责。所有脚本按职责分组；新增脚本须在本文件登记。

## 骨架检查（当前可运行）

| 脚本 | 用途 | 成功条件 |
|------|------|----------|
| `doctor.mjs` | 验证 Node 版本、workspace、.env.example、PRD 存在 | Node 24.x + 所有文件存在 |
| `check-scaffold.mjs` | 验证目录结构、Markdown 链接、JSON 语法、FR/AT/RB 行完整性 | 无 broken link、JSON 可解析、行数正确 |
| `ts04-clone-verify.mjs` | TS04：模拟全新 clone，验证所有文档化命令可找到 | 23 个必需文件 + 5 个命令全部存在 |

合约构建、测试和尺寸检查已经由根 `package.json` 提供：`npm run build:contracts`、`npm run test:contracts`、`npm run check:contract-sizes`。它们使用固定的 `@foundry-rs/forge@1.7.1`，不再是 RB-04 占位命令。

## 占位命令（RB-xx 实现前）

| 脚本 | 责任 Issue | 行为 |
|------|------------|------|
| `not-implemented.mjs` | 各自对应 | 打印 `[NOT IMPLEMENTED] {command}: 当前为协作框架。请先完成 {RB-xx}。` 并返回退出码 1 |

## 数据导入（一次性）

| 脚本 | 用途 | 输入 |
|------|------|------|
| `import-prd.py` | 从标准库 DOCX 提取文本/表格/链接，转换为纯文本 | `docs/PRD.md` 原文 |
| `init-traceability.py` | 初始化 `docs/requirements-traceability.md` 行号映射 | 拒绝覆盖已有行 |

## 测试网证据（只读）

| 脚本 | 用途 | 成功/失败条件 |
| --- | --- | --- |
| `verify-monad-evidence.mjs` | 核对用户记录的 Monad Testnet 链 ID、当前字节码存在、交易收据/发送方/接收方 | 全部字段匹配才退出 0；错误链、空字节码、缺失或失败收据、地址不符退出 1；不证明源码身份或业务阶段 |
| `verify-monad-evidence.test.mjs` | 用本地模拟 RPC 检查上述失败关闭路径 | 5 项本地测试全部通过；不会访问外部 RPC |
| `attest-monad-deployment.mjs` | 核对五份部署回执/首次代码块、三种固定编译配置的可执行代码、ABI 摘要、创建/入金事件、条款/Registry/会计/余额，输出只读 JSON 快照 | 任意链、源码/代码、事件、指针或资金不符即退出 1；不会签名或广播；不替代独立审查或完整验收 |
| `attest-monad-deployment.test.mjs` | 检查字节码可执行部分比较对 metadata、immutable 与篡改 opcode 的处理 | 3 项本地测试通过；不会访问外部 RPC |

## 注意事项

- `not-implemented.mjs` 不修改状态；业务命令实现后替换为真实脚本。
- 不要在脚本中写入密钥或真实私钥。
- 新脚本须登记：名称、用途、成功/失败条件。
