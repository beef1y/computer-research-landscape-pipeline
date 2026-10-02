"""Build a self-contained expandable HTML/Markdown mindmap from groups and papers."""

from __future__ import annotations

import html
import json
from typing import Any

from common import ANALYSIS, clean, excluded_group_ids, group_index, load_group_state, load_papers, paper_d, publication, write_text


def tree_data() -> dict[str, Any]:
    papers = load_papers()
    state = load_group_state()
    by_id = {str(paper.get("id")): paper for paper in papers}
    _, children = group_index(state)
    excluded = excluded_group_ids(state)
    used: set[str] = set()

    def build_group(group: dict[str, Any]) -> dict[str, Any]:
        gid = str(group.get("id"))
        nodes: list[dict[str, Any]] = [build_group(child) for child in children.get(gid, []) if str(child.get("id")) not in excluded]
        paper_nodes: list[dict[str, Any]] = []
        for paper_id in group.get("paperIds", []):
            pid = str(paper_id)
            if pid in used or pid not in by_id:
                continue
            used.add(pid)
            paper = by_id[pid]
            _, year, venue = publication(paper.get("venueYear"))
            descriptor = paper_d(paper)
            paper_nodes.append({
                "kind": "paper",
                "id": pid,
                "title": clean(paper.get("title")),
                "year": year,
                "venue": venue,
                "Q": clean(paper.get("Q")),
                "D": descriptor.get("primary", "未报告"),
            })
        return {"kind": "group", "id": gid, "name": clean(group.get("name")), "description": clean(group.get("description")) if group.get("description") else "", "children": nodes, "papers": paper_nodes}

    roots = [build_group(group) for group in children.get(None, []) if str(group.get("id")) not in excluded]
    excluded_ids = {str(paper_id) for gid, group in group_index(state)[0].items() if gid in excluded for paper_id in group.get("paperIds", [])}
    unassigned = [
        {"kind": "paper", "id": str(paper.get("id")), "title": clean(paper.get("title")), "year": publication(paper.get("venueYear"))[1], "venue": publication(paper.get("venueYear"))[2], "Q": clean(paper.get("Q")), "D": paper_d(paper).get("primary", "未报告")}
        for paper in papers
        if str(paper.get("id")) not in used and str(paper.get("id")) not in excluded_ids
    ]
    return {"kind": "root", "name": "Computer Research Landscape", "total": len(papers), "assigned": len(used), "unassigned": len(unassigned), "children": roots, "unassignedPapers": unassigned}


def markdown(tree: dict[str, Any]) -> str:
    lines = ["# Computer Research Landscape Mindmap", "", f"- 总论文：{tree['total']}", f"- 已分组：{tree['assigned']}", f"- 未分组：{tree['unassigned']}", ""]

    def group_lines(group: dict[str, Any], depth: int) -> None:
        lines.append("  " * depth + f"- {group['name']}（{len(group['papers']) + sum(count_papers(child) for child in group['children'])}）")
        if group.get("description"):
            lines.append("  " * (depth + 1) + f"说明：{group['description']}")
        for child in group["children"]:
            group_lines(child, depth + 1)
        for paper in group["papers"]:
            lines.append("  " * (depth + 1) + f"- {paper['year']} {paper['title']}｜Q：{paper['Q']}｜D：{paper['D']}")

    def count_papers(group: dict[str, Any]) -> int:
        return len(group["papers"]) + sum(count_papers(child) for child in group["children"])

    for group in tree["children"]:
        group_lines(group, 0)
    if tree["unassignedPapers"]:
        lines.append("- 未分组")
        for paper in tree["unassignedPapers"]:
            lines.append(f"  - {paper['year']} {paper['title']}｜Q：{paper['Q']}｜D：{paper['D']}")
    return "\n".join(lines)


def html_page(tree: dict[str, Any]) -> str:
    payload = json.dumps(tree, ensure_ascii=False).replace("</", "<\\/")
    return f"""<!doctype html>
<html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Computer Research Landscape</title>
<style>body{{font:14px/1.55 system-ui,"Microsoft YaHei",sans-serif;color:#22313b;margin:0;background:#f7f9fb}}header{{padding:18px 24px;background:#173b4d;color:#fff}}main{{max-width:1100px;margin:20px auto;padding:0 18px}}details{{margin:8px 0;padding:8px 12px;background:#fff;border:1px solid #d7e0e5;border-radius:8px}}summary{{cursor:pointer;font-weight:700}}.paper{{margin:8px 0 0 18px;padding:8px;background:#f1f6f8;border-left:3px solid #2f7c8a}}.meta{{color:#63727b;font-size:12px}}input{{padding:8px;width:min(420px,90vw);border:1px solid #b9c7ce;border-radius:5px}}</style></head>
<body><header><h1>Computer Research Landscape</h1><div id=\"status\"></div></header><main><input id=\"search\" placeholder=\"搜索论文、Q 或 D\"><section id=\"map\"></section></main>
<script>const DATA={payload};const map=document.querySelector('#map'),search=document.querySelector('#search'),status=document.querySelector('#status');status.textContent=`总论文 ${{DATA.total}} · 已分组 ${{DATA.assigned}} · 未分组 ${{DATA.unassigned}}`;function esc(v){{return String(v??'').replace(/[&<>\"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}}[c]))}}function paper(p){{return `<div class=\"paper\" data-text=\"${{esc([p.title,p.Q,p.D].join(' '))}}\"><b>${{esc(p.title)}}</b><div class=\"meta\">${{esc(p.year)}} · ${{esc(p.venue)}} · Q：${{esc(p.Q)}} · D：${{esc(p.D)}}</div></div>`}}function group(g){{return `<details open data-text=\"${{esc([g.name,g.description].join(' '))}}\"><summary>${{esc(g.name)}}（${{g.papers.length+g.children.reduce((n,c)=>n+count(c),0)}}）</summary>${{g.description?`<div class=\"meta\">${{esc(g.description)}}</div>`:''}}${{g.children.map(group).join('')}}${{g.papers.map(paper).join('')}}</details>`}}function count(g){{return g.papers.length+g.children.reduce((n,c)=>n+count(c),0)}}function render(){{const q=search.value.trim().toLowerCase();map.innerHTML=DATA.children.map(group).join('')+(DATA.unassignedPapers.length?`<details open><summary>未分组（${{DATA.unassignedPapers.length}}）</summary>${{DATA.unassignedPapers.map(paper).join('')}}</details>`:'');if(q)map.querySelectorAll('[data-text]').forEach(el=>{{if(!el.dataset.text.toLowerCase().includes(q))el.style.display='none'}})}}search.addEventListener('input',render);render();</script></body></html>"""


def main() -> int:
    tree = tree_data()
    write_text(ANALYSIS / "research-landscape-mindmap.md", markdown(tree))
    page = html_page(tree)
    write_text(ANALYSIS / "research-landscape-mindmap.html", page)
    write_text(__import__("pathlib").Path(__file__).resolve().parents[1] / "paper-library" / "research-landscape-mindmap.html", page)
    print(json.dumps({"markdown": str(ANALYSIS / "research-landscape-mindmap.md"), "html": str(ANALYSIS / "research-landscape-mindmap.html"), "assigned": tree["assigned"], "unassigned": tree["unassigned"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
