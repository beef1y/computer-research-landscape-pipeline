"""Shared paths and data helpers for the self-contained research pipeline."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "paper-library" / "data"
ANALYSIS = ROOT / "analysis"
PAPERS = DATA / "papers.json"
GROUP_STATE = DATA / "group-state.json"

EXCLUDED_GROUP_NAME = "信息不全/不相干/重复"


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"无法读取 {path}: {exc}") from exc


def save_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_papers() -> list[dict[str, Any]]:
    value = load_json(PAPERS, [])
    if not isinstance(value, list):
        raise SystemExit(f"{PAPERS} 必须是 JSON 数组")
    return [item for item in value if isinstance(item, dict)]


def load_group_state() -> dict[str, Any]:
    value = load_json(GROUP_STATE, {"groups": [], "unassignedIds": []})
    if not isinstance(value, dict):
        raise SystemExit(f"{GROUP_STATE} 必须是 JSON 对象")
    value.setdefault("groups", [])
    value.setdefault("unassignedIds", [])
    return value


def clean(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<br\s*/?>", "；", text, flags=re.I)
    text = re.sub(r"\s+", " ", text)
    return text.strip() or "未报告"


def markdown_cell(value: Any) -> str:
    return clean(value).replace("|", r"\|").replace("\n", "<br>")


def title_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", str(value or "").lower())


def publication(value: Any) -> tuple[int, str, str]:
    raw = clean(value)
    years = re.findall(r"(?<!\d)(?:19|20)\d{2}(?!\d)", raw)
    if not years:
        return 9999, "年份未报告", raw
    year = years[-1]
    venue = re.sub(r"\b" + year + r"\b", "", raw, count=1).strip(" ,/()-")
    return int(year), year, venue or "发表场所未报告"


def paper_d(paper: dict[str, Any]) -> dict[str, Any]:
    """Read explicit paper-level D only; never infer it from Delta."""
    raw = paper.get("D", paper.get("d"))
    if isinstance(raw, str):
        return {"primary": raw, "secondary": [], "raw": raw, "evidence": []}
    if isinstance(raw, list):
        values = [clean(item) for item in raw if clean(item) != "未报告"]
        return {"primary": values[0] if values else "未报告", "secondary": values[1:], "raw": values, "evidence": []}
    if isinstance(raw, dict):
        primary = clean(raw.get("primary"))
        secondary = raw.get("secondary", [])
        if isinstance(secondary, str):
            secondary = [secondary]
        return {
            "primary": primary,
            "secondary": [clean(item) for item in secondary if clean(item) != "未报告"],
            "raw": raw.get("raw", primary),
            "evidence": raw.get("evidence", []),
            "normalized": raw.get("normalized"),
        }
    return {"primary": "未报告", "secondary": [], "raw": "未报告", "evidence": []}


def d_labels(paper: dict[str, Any]) -> list[tuple[str, str]]:
    descriptor = paper_d(paper)
    result: list[tuple[str, str]] = []
    primary = clean(descriptor.get("normalized") or descriptor.get("primary"))
    if primary != "未报告":
        result.append((primary, "primary"))
    for value in descriptor.get("secondary", []):
        label = clean(value)
        if label != "未报告":
            result.append((label, "secondary"))
    return result


def group_index(state: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str | None, list[dict[str, Any]]]]:
    groups = [group for group in state.get("groups", []) if isinstance(group, dict)]
    by_id = {str(group.get("id")): group for group in groups}
    children: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
    for group in groups:
        parent = str(group.get("parentId")) if group.get("parentId") else None
        children[parent].append(group)
    return by_id, children


def excluded_group_ids(state: dict[str, Any]) -> set[str]:
    by_id, children = group_index(state)
    roots = {gid for gid, group in by_id.items() if clean(group.get("name")) == EXCLUDED_GROUP_NAME}
    excluded = set(roots)
    queue = list(roots)
    while queue:
        parent = queue.pop()
        for child in children.get(parent, []):
            child_id = str(child.get("id"))
            if child_id not in excluded:
                excluded.add(child_id)
                queue.append(child_id)
    return excluded


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")
