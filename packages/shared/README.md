# 共享包

E维护入口，B审阅金额及合约类型，D审阅schema，C消费。

本次C提供 `@rentbond/shared` workspace包，导出 `src/money.ts`：字符串/bigint转换、两位业务小数、1—10,000 MockUSD押金范围及守恒检查。底层6位精度，业务步长10,000基础单位，不用浮点数计算资金。

用法：`import { parseMoney, formatMoney, assertAccounting } from '@rentbond/shared'`。Next配置包含transpilePackages；独立Node消费者需自己的TypeScript构建。B/E合并前复核接口；前端测试不能代替Solidity检查。截止、schema、承诺算法尚未在此实现，不能把fixture模型当作生产协议。
