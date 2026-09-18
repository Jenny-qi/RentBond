# Web 页面与服务端

C 负责页面、账户、交易；D 负责 app/api/ 与 server/。目标为 Next.js App Router，当前只有目录骨架，无可启动网页。

src/app/ 页面与布局；src/components/ 可复用界面；src/features/ 按租约/申索/账户划分。src/app/api/ 为 D 的 HTTP 入口，src/server/ 为服务端业务、权限和存储。

先完成 RB-02/08，再按 RB-09/10/11 接入。账户与页面可用明确标注的 fixtures 开发布局；真实资金验收必须连合约。界面使用 MockUSD，预计拆分/可领取/已领取不可混淆。

