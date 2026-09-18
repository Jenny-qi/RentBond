"""Initialize reviewable FR/SC/AT tables from the baseline; never overwrite results."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = (root / "docs/PRD.md").read_text(encoding="utf-8")
targets = [root / "docs/requirements-traceability.md", root / "docs/acceptance.md"]
if any(p.exists() for p in targets):
    raise SystemExit("Refusing to overwrite existing requirement/test status files.")

fr = dict(re.findall(r"^FR-(\d{2})[：:]\s*(.+)$", source, re.M))
sc = dict(re.findall(r"^SC-(\d{2})[：:]\s*(.+)$", source, re.M))
at = {}
for line in source.splitlines():
    m = re.match(r"^\| AT(\d{2}) \| (.+?) \| (.+?) \|$", line)
    if m:
        at[m[1]] = (m[2], m[3])
assert len(fr) == 34, len(fr)
assert len(sc) == 16, len(sc)
assert len(at) == 52, len(at)

fr_map = {
1:("C", "apps/web/src/features/", "AT41"),
2:("B/C", "contracts/src/; packages/shared/src/", "AT02/10/36"),
3:("B", "contracts/src/", "AT01/02/38/40"),
4:("B", "contracts/src/", "AT02/24/25"),
5:("B/C", "contracts/src/; apps/web/src/features/", "AT03/12/23"),
6:("C/D", "apps/web/src/app/; apps/web/src/server/", "AT27/41/52"),
7:("B/C", "contracts/src/; apps/web/src/features/", "AT01/02/37/38/40"),
8:("B/C", "contracts/src/; apps/web/src/features/", "AT03/41/43"),
9:("B", "contracts/src/", "AT01/02/26"),
10:("C/D", "apps/web/src/features/; apps/web/src/server/", "AT27/33/35"),
11:("B/D", "contracts/src/; apps/web/src/server/", "AT33/35"),
12:("C/D", "apps/web/src/features/; apps/web/src/server/", "AT33/35"),
13:("B/C", "contracts/src/", "AT05/06/45/50"),
14:("B", "contracts/src/", "AT07/45/50"),
15:("B", "contracts/src/", "AT08/50"),
16:("B/C", "contracts/src/", "AT10/11/26"),
17:("C/D", "apps/web/src/features/; apps/web/src/server/", "AT11/27/33"),
18:("B/D", "contracts/src/; apps/web/src/server/", "AT11/35"),
19:("B", "contracts/src/", "AT09/12/14/26"),
20:("B/C", "contracts/src/", "AT12/13/26"),
21:("B", "contracts/src/", "AT13/26"),
22:("B", "contracts/src/", "AT14/15"),
23:("B", "contracts/src/", "AT13/36"),
24:("B/D", "contracts/src/; apps/web/src/server/", "AT27/44/47"),
25:("B/C", "contracts/src/", "AT16/36"),
26:("B/C", "contracts/src/", "AT16/17/26"),
27:("B", "contracts/src/", "AT18/47"),
28:("B/D", "contracts/src/; apps/web/src/server/", "AT19/20/44"),
29:("B/E", "contracts/src/; apps/worker/src/", "AT20/46/47/48/49"),
30:("B/C", "contracts/src/", "AT21/22/49"),
31:("B/E", "contracts/src/; scripts/", "AT04/23/24/51"),
32:("B/C", "contracts/src/; apps/web/src/features/", "AT23/46/47"),
33:("D/E", "apps/web/src/server/; apps/worker/src/", "AT27/33"),
34:("B/C/D", "contracts/src/; apps/web/src/server/", "AT33/35")}
sc_tests = ["AT29", "AT29/30", "AT03/29/30", "AT30", "AT31/47/51", "AT04/51", "AT12/23/24/36/46", "AT10/36", "AT02/03", "AT21/22/49", "AT17/18/49", "AT09/26", "AT32/51", "AT02/10/36/40/52", "AT36", "AT35"]
header = ["# 需求追踪表", "", "FR/SC 来自 v1.2，初始映射用于计划，尚无实现证据。implementationFiles 先为 `—`，不能把目录占位视为实现。Verified 需要 commit、测试及证据。", "",
"| requirementId | 原文位置与摘要 | owner | plannedLocation | implementationFiles | testIds | status | commit | evidenceLink |",
"| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
for prefix, values in [("FR", fr), ("SC", sc)]:
    for num, body in sorted(values.items()):
        n = int(num)
        if prefix == "FR":
            owner, location, tests = fr_map[n]
        else:
            owner, location, tests = (("E", "apps/worker/src/; packages/shared/src/", sc_tests[n-1]) if n <= 5
                                      else ("B", "contracts/src/", sc_tests[n-1]))
        summary = body.split("。")[0].replace("|", "\\|")
        section = "6/7章" if prefix == "FR" else "10/11章"
        header.append(f"| {prefix}-{num} | PRD {section}：{summary} | {owner} | {location} | — | {tests} | Not started | — | — |")
header += ["", "AT 的逐条状态与来源完整场景见 [acceptance](acceptance.md)。展示变化 CH01—09 见 [changes](changes.md)，这些文档变化不代表 FR/SC 业务已完成。", ""]
targets[0].write_text("\n".join(header), encoding="utf-8")

out = ["# 验收清单", "", "以下保留原 PRD 15.2 的全部 AT 场景及预期。当前业务均未实现、未运行；骨架检查不计入 AT。负责人是初始分配，可在 team 确认后调整。", "",
"需求状态：Not started / In progress / Blocked / Verified。运行结果独立记 Not run / Passed / Failed。Verified 必须有固定 commit、命令、环境与证据；失败记录不可删除或改成通过。", "",
"## 前置技术试验", "", "| ID | 试验 | 负责人 | 状态 | 证据 |", "| --- | --- | --- | --- | --- |",
"| TS01 | 网络、四账户、错误链和拒签 | B/E | Not started | — |",
"| TS02 | 最小真实资金闭环与权限 | B/E | Not started | — |",
"| TS03 | SIWE 与私有文件越权拒绝 | D/C | Not started | — |",
"| TS04 | 独立成员从新 clone 完整运行 | E | Not started | — |",
"| TS05 | passkey 同地址恢复、费用、取消不执行 | C/D | Not started | — |", "",
"## 完整业务用例", "", "| ID | 场景（PRD 原文） | 预期（PRD 原文） | owner | status | lastResult | commit / evidence |",
"| --- | --- | --- | --- | --- | --- | --- |"]
for num, (scenario, expected) in sorted(at.items()):
    n = int(num)
    owner = "B/E"
    if n in [27,28,33,44]: owner = "D/E"
    if n in [3,41,42,43]: owner = "C/D/E"
    if n in [29,30,31,34,51]: owner = "E（B/C/D协作）"
    out.append(f"| AT{num} | {scenario} | {expected} | {owner} | Not started | Not run | — |")
out += ["", "## 证据记录格式", "", "每次运行记录：日期、操作者、代码 commit、网络/工具版本、命令、实际输出、交易/截图或脱敏日志路径、Passed/Failed/Not run、剩余问题。推荐把报告放 tests/reports/（不含敏感材料），然后把链接填入表格。", "",
"## 发布门槛", "", "全部 P0、关键权限/金额/边界/恢复通过，第二人复核；没有执行的不写通过。测试网交易、ABI、条款与 hardEndAt 对齐；主 Demo 三角色不能豁免备用与异常验收。", ""]
targets[1].write_text("\n".join(out), encoding="utf-8")
print("Initialized 34 FR, 16 SC, 52 AT and 5 TS entries; all business statuses unverified.")
