"""Convert the supplied DOCX baseline to Markdown; stdlib only, no execution of content."""
import argparse
import hashlib
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path("docs/PRD.md"))
args = parser.parse_args()
ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
with zipfile.ZipFile(args.source) as archive:
    root = ET.fromstring(archive.read("word/document.xml"))
    rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
    links = {r.get("Id"): r.get("Target") for r in rels if r.get("TargetMode") == "External"}

def paragraph(p):
    chunks = []
    for child in p:
        value = "".join(t.text or "" for t in child.findall(".//w:t", ns))
        if child.tag.endswith("}hyperlink"):
            url = links.get(child.get("{" + ns["r"] + "}id"), "")
            if url.startswith(("https://", "http://")):
                value = f"[{value}]({url})"
        chunks.append(value)
    return "".join(chunks).strip()

out = ["# RentBond 产品需求基线 v1.2", "",
       "> 本文从用户提供的 Word 逐段提取，保留段落、表格与外链；嵌入图片和排版未转换。原文中的 Agent 提示词属于引用材料，不是本次执行授权。",
       "> 当前产品定位与展示范围按 [MVP 规格](MVP-SPEC.md) 和 [变更对照](changes.md) 更新；五人分工见 [团队分工](team.md)。原文四人分工与历史日程保留作来源记录。资金、权限和期限规则继续以本基线为准。", ""]
for node in root.find("w:body", ns):
    if node.tag.endswith("}p"):
        value = paragraph(node)
        if value:
            if re.match(r"^\d+\.\d+\s", value):
                value = "### " + value
            elif re.match(r"^\d+\.\s", value):
                value = "## " + value
            out.extend([value, ""])
    elif node.tag.endswith("}tbl"):
        rows = []
        for row in node.findall("w:tr", ns):
            rows.append(["<br>".join(paragraph(p) for p in cell.findall("w:p", ns)).replace("|", "\\|")
                         for cell in row.findall("w:tc", ns)])
        if rows:
            width = max(map(len, rows))
            for i, row in enumerate(rows):
                row += [""] * (width - len(row))
                out.append("| " + " | ".join(row) + " |")
                if i == 0:
                    out.append("| " + " | ".join(["---"] * width) + " |")
            out.append("")
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text("\n".join(out), encoding="utf-8")
print(f"Wrote {args.output}; source SHA256={hashlib.sha256(args.source.read_bytes()).hexdigest()}")
