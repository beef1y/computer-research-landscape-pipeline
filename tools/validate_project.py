"""Validate the catalog, group state, provenance, and paper-level D traceability."""

from __future__ import annotations

import json
from collections import Counter

from common import d_labels, excluded_group_ids, load_group_state, load_papers, paper_d, title_key


def main() -> int:
    papers = load_papers()
    state = load_group_state()
    ids = [str(paper.get("id", "")) for paper in papers]
    errors: list[str] = []
    warnings: list[str] = []
    if not all(ids):
        errors.append("存在缺少 id 的论文")
    duplicates = [paper_id for paper_id, count in Counter(ids).items() if count > 1]
    if duplicates:
        errors.append(f"paper id 重复：{', '.join(duplicates)}")
    by_id = set(ids)
    grouped_ids: list[str] = []
    for group in state.get("groups", []):
        grouped_ids.extend(str(paper_id) for paper_id in group.get("paperIds", []))
    missing = sorted(set(grouped_ids) - by_id)
    if missing:
        errors.append(f"分组引用不存在的 paper id：{', '.join(missing)}")
    duplicates_in_groups = [paper_id for paper_id, count in Counter(grouped_ids).items() if count > 1]
    if duplicates_in_groups:
        errors.append(f"论文被放入多个分组：{', '.join(duplicates_in_groups)}")
    no_d = [str(paper.get("id")) for paper in papers if not paper_d(paper).get("primary")]
    if no_d:
        errors.append(f"缺少论文级 D（允许明确写未报告）：{', '.join(no_d[:10])}")
    if len({title_key(paper.get("title")) for paper in papers}) != len(papers):
        warnings.append("存在重复标题；合并前应确认版本关系")
    result = {"papers": len(papers), "groups": len(state.get("groups", [])), "grouped": len(set(grouped_ids)), "excludedGroups": len(excluded_group_ids(state)), "warnings": warnings, "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
