"""Build a generic grouped research-landscape Markdown report and JSON snapshot."""

from __future__ import annotations

import json
from collections import Counter
from typing import Any

from common import (
    ANALYSIS,
    EXCLUDED_GROUP_NAME,
    clean,
    d_labels,
    excluded_group_ids,
    group_index,
    load_group_state,
    load_papers,
    markdown_cell,
    paper_d,
    publication,
    save_json,
    title_key,
    write_text,
)


def paper_view(paper: dict[str, Any]) -> dict[str, Any]:
    sort_year, year, venue = publication(paper.get("venueYear"))
    descriptor = paper_d(paper)
    return {
        "id": str(paper.get("id", "")),
        "sortYear": sort_year,
        "year": year,
        "venue": venue,
        "title": clean(paper.get("title")),
        "Q": clean(paper.get("Q")),
        "delta": clean(paper.get("delta")),
        "D": descriptor,
        "metric": clean(paper.get("metric")),
        "baseline": clean(paper.get("baseline")),
        "groundTruth": clean(paper.get("groundTruth")),
        "conclusion": clean(paper.get("conclusion")),
        "source": paper.get("source", paper.get("provenance", {})),
    }


def main() -> int:
    rows = load_papers()
    state = load_group_state()
    by_id = {str(paper.get("id")): paper for paper in rows}
    by_group, children = group_index(state)
    excluded = excluded_group_ids(state)
    used: set[str] = set()

    def build_group(group: dict[str, Any], depth: int) -> dict[str, Any]:
        gid = str(group.get("id"))
        child_nodes = [build_group(child, depth + 1) for child in children.get(gid, []) if str(child.get("id")) not in excluded]
        papers: list[dict[str, Any]] = []
        for paper_id in group.get("paperIds", []):
            pid = str(paper_id)
            if pid in used or pid not in by_id or pid in {str(x) for x in []}:
                continue
            used.add(pid)
            papers.append(paper_view(by_id[pid]))
        papers.sort(key=lambda paper: (paper["sortYear"], paper["title"].casefold()))
        return {
            "id": gid,
            "name": clean(group.get("name")),
            "description": clean(group.get("description")) if group.get("description") else "",
            "depth": depth,
            "children": child_nodes,
            "papers": papers,
        }

    roots = [build_group(group, 1) for group in children.get(None, []) if str(group.get("id")) not in excluded]
    included = [paper_view(paper) for paper in rows if str(paper.get("id")) not in {str(x) for x in []}]
    excluded_paper_ids = {
        str(paper_id)
        for gid, group in by_group.items()
        if gid in excluded
        for paper_id in group.get("paperIds", [])
    }
    included = [paper for paper in included if paper["id"] not in excluded_paper_ids]
    unassigned = [paper for paper in included if paper["id"] not in used]

    d_stats: dict[str, dict[str, Any]] = {}
    for paper in included:
        for label, role in d_labels(by_id[paper["id"]]):
            entry = d_stats.setdefault(label, {"label": label, "paperIds": [], "primaryCount": 0, "secondaryCount": 0, "rawLabels": []})
            if paper["id"] not in entry["paperIds"]:
                entry["paperIds"].append(paper["id"])
            entry["rawLabels"].append({"paperId": paper["id"], "role": role, "label": label})
            entry["primaryCount" if role == "primary" else "secondaryCount"] += 1
    d_aggregation = sorted(d_stats.values(), key=lambda item: (-len(item["paperIds"]), item["label"]))
    years = Counter(paper["year"] for paper in included if paper["year"] != "年份未报告")
    dataset = {
        "totalRows": len(rows),
        "uniqueTitles": len({title_key(paper.get("title")) for paper in rows}),
        "includedCount": len(included),
        "assignedCount": len(used),
        "unassignedCount": len(unassigned),
        "excludedCount": len(rows) - len(included),
        "yearCounts": dict(sorted(years.items())),
        "groups": roots,
        "unassigned": unassigned,
        "dAggregation": d_aggregation,
    }
    save_json(ANALYSIS / "research-landscape-grouped.json", dataset)

    lines = [
        "# Computer Research Landscape",
        "",
        f"> 目录 {len(rows)} 条记录；按标题规范化后 {dataset['uniqueTitles']} 个标题；纳入 {len(included)} 条，已分组 {len(used)} 条，未分组 {len(unassigned)} 条；排除 {dataset['excludedCount']} 条。",
        "",
        "## 1. 年份分布",
        "",
        "| 年份 | 论文数量 |",
        "| --- | ---: |",
    ]
    lines.extend(f"| {year} | {count} |" for year, count in sorted(years.items()))
    lines.extend(["", "## 2. D 聚合", "", "D 聚合只使用论文记录中已经提取的 D；每个聚合标签都保留贡献论文 ID。", "", "| D | 论文数 | primary | secondary | 论文 ID |", "| --- | ---: | ---: | ---: | --- |"])
    for entry in d_aggregation:
        ids = ", ".join(entry["paperIds"])
        lines.append(f"| {markdown_cell(entry['label'])} | {len(entry['paperIds'])} | {entry['primaryCount']} | {entry['secondaryCount']} | {markdown_cell(ids)} |")
    if not d_aggregation:
        lines.append("| 未报告 | 0 | 0 | 0 | — |")

    def flatten(group: dict[str, Any]) -> list[dict[str, Any]]:
        result = list(group["papers"])
        for child in group["children"]:
            result.extend(flatten(child))
        return result

    def write_group(group: dict[str, Any], heading: str) -> None:
        lines.extend(["", f"{heading} {group['name']}（{len(flatten(group))} 篇）", ""])
        if group["description"]:
            lines.extend([group["description"], ""])
        for child in group["children"]:
            write_group(child, "#" * min(6, len(heading) + 1))
        if group["papers"]:
            lines.extend(["| 发表地方/年份 | 论文标题 | Q | Δ | D | metric | baseline | ground truth | 结论 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"])
            for paper in group["papers"]:
                d = paper["D"].get("primary", "未报告") if isinstance(paper["D"], dict) else "未报告"
                lines.append("| " + " | ".join(markdown_cell(value) for value in (f"{paper['venue']} {paper['year']}", paper["title"], paper["Q"], paper["delta"], d, paper["metric"], paper["baseline"], paper["groundTruth"], paper["conclusion"])) + " |")

    lines.extend(["", "## 3. 按 Q 分组的论文研究链"])
    for root in roots:
        write_group(root, "###")
    if unassigned:
        lines.extend(["", "## 4. 未分组论文", "", "未分组论文保留在目录中，等待人工放入 Q 分组。", ""])
        lines.extend(f"- {paper['id']}：{paper['title']}（Q：{paper['Q']}）" for paper in unassigned)
    write_text(ANALYSIS / "research-landscape-current.md", "\n".join(lines))
    print(json.dumps({"report": str(ANALYSIS / "research-landscape-current.md"), "dataset": str(ANALYSIS / "research-landscape-grouped.json"), "rows": len(rows), "included": len(included), "dLabels": len(d_aggregation)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
