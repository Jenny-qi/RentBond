# 服务端领域模块

负责人 D。已实现 auth、leases、documents、statements、exports、test-gas、db 与事件同步接口。

服务端密钥不得被 shared 或客户端导入；SIWE nonce 原子消费；材料版本追加不可覆盖。

RB-08 的本地启动、服务配置、C/E 接口和验证边界见 [成员 D 交接](../../../../docs/member-d-handoff.md)。测试在 tests/，CLI 入口 cli.mjs。当前网页仍由 C 接线，不能把 API 测试等同完整产品验收。
