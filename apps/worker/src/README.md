# Worker 源码边界

计划 indexer/ 读取与回放；jobs/ 幂等到期任务；notifications/ 提醒接口（邮件 P1）；exports/ 导出任务消费。

停止 Worker 不得冻结合约退出。重启不能重复分配；任务期限来自已确认链上参数，不因重试延长。

