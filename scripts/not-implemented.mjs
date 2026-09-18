const [command = 'unknown', issue = 'RB-02'] = process.argv.slice(2);
console.error(`[NOT IMPLEMENTED] ${command}: 当前为协作框架。请先完成 ${issue}，见 docs/backlog.md。`);
process.exitCode = 1;
