# ADR 0002 Mera 账户试验与稳定派生标识

状态：仅采用于 C 的 TS05 技术试验，2026-09-25；真实部署与资金账户未放行。不改变 v1.2 金额、受益人、权限或期限。

## 决定

固定 `@category-labs/mera@0.2.0`；配套 `viem@2.56.9`。源码依据为官方 npm 包中的 `src/passkey.ts`、`src/secp256k1.ts`、`src/viem.ts`，而非猜测历史 SDK API。

试验固定 PRF salt 为 `SHA-256(UTF-8("rentbond.mera.evm.v1"))`，PRF 的 32 字节输出作为 secp256k1 输入，非法标量直接失败；不会自动新建另一把凭证。RP ID 是实际网页 hostname。恢复必须使用同域名、同派生版本与原通行密钥，并与用户提供的原地址逐字节等价比较。迁移域名、换 salt、换版本、新建 passkey 均不能被当作恢复。

目前页面只核对地址。签名会话在得到地址或错误时立即 `end()`，返回的 PRF 数组在 finally 清零；组件离页/取消后的迟到结果丢弃。没有保存私钥、PRF、签名会话或凭证元数据。页面仅临时显示公开地址/域名，后端 SIWE 和资金签名须在后续独立明确确认流程中接入。

试验与虚构 Alice 会话隔离，不将真实新地址绑定到演示租约，不发网络交易。SDK 使用连续签名会话的能力不构成资金自动签名许可。

## 验收和影响

映射：FR-07/08/31，SC-06/09，TS05、AT41/42/43/51。单元测试使用显式注入的 WebAuthn 替身和公开测试向量，只证明适配逻辑和 Mera/viem 签名兼容；无法证明目标设备 PRF、跨设备恢复或后台登录成功。

C 需在真实目标手机/桌面及明确 HTTPS 域名验证；D 提供 SIWE/Gas；B/E 提供链部署与确认策略。未满足前维持 In progress。不得迁移已入金账户，也不得把 Privy 或外部钱包静默当作已通过的 P0。

官方来源：[Mera 仓库](https://github.com/category-labs/mera)、[Mera npm](https://www.npmjs.com/package/@category-labs/mera)、[viem](https://github.com/wevm/viem)。证据见 [C 本地报告](../../tests/reports/2026-09-25-member-c.md)。
