# 共享模块规划

计划 money/、schemas/、types/、commitments/、network/，详见 docs/interfaces/shared.md。

JSON 金额字符串，TS bigint，6 位底层精度及 10000 步长；前端输入最多两位小数。不得导入服务端凭据。

