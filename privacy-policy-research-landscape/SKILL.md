---
name: computer-research-landscape
description: Build a reusable computer-science research landscape from paper PDFs or full-text links, using abstract-only extraction as a stated fallback. Extract each paper's Q, Δ, paper-level D, metrics, baselines, ground truth, and conclusions, then deduplicate, group by Q, aggregate the extracted D descriptors, and regenerate Markdown, mindmap, and PPT outputs.
---

# Computer Research Landscape

This skill maintains a continuing research landscape for computer-science topics. The legacy directory name `privacy-policy-research-landscape` is retained for compatibility, but the workflow is domain-general.

The entry point is a paper source:

1. a local PDF;
2. a full-text URL;
3. an abstract or bibliographic record only when full text cannot be obtained.

Record the source and evidence limit for every paper. When only an abstract is available, extract only supported facts and mark the remaining fields `未报告`; do not write method or result details that the abstract does not support.

Read [references/pipeline.md](references/pipeline.md) before changing the corpus or any generated deliverable. For every paper, use the extraction rules in [skills/paper-pdf-research-chain/SKILL.md](../skills/paper-pdf-research-chain/SKILL.md) and preserve this field order:

`发表地方缩写/年份 → 论文标题 → Q → Δ → metric → baseline → ground truth → 结论`

The paper-level `D` is an additional extracted method descriptor. It is grounded in the paper's `Δ`, method, and evaluation sections. It is not selected from a preset research-direction list. Store its primary and secondary descriptors, raw wording, source evidence, and any later normalization in the normalized JSON record.

The workflow has six linked phases:

1. Extract an evidence-backed paper row and paper-level D from a PDF or full-text link, with abstract fallback.
2. Deduplicate and synchronize the CSV/JSON catalog while preserving stable paper IDs, provenance, and D descriptors.
3. Place each paper under `研究对象 → Q → Q细分`, preserving the user's manual grouping as the source of truth.
4. Aggregate the extracted paper-level D values across Q; never assign D from a preset direction list.
5. Rebuild the grouped Markdown and mindmap from the catalog and group state.
6. Rebuild the PPT when required, then run catalog, source, grouping, D-traceability, rendering, and consistency checks.

Do not silently invent venue, sample, metric, baseline, result, Q, or D information. Use `未报告` or a scoped qualifier when the source does not support a field. Do not modify the extraction skill or the user's manual group state to fix a generated view; fix the builder or create a clearly named new Q group instead.

## Paper-level D and cross-Q aggregation

For each paper, extract:

- `D.primary`: the main concrete method route used by the paper;
- `D.secondary`: additional method routes materially used by the paper;
- `D.raw`: wording close to the paper's own description;
- `D.evidence`: section, page, table, or figure locations;
- `D.normalized`: an optional label created later only when a synonym rule is explicit.

Aggregation counts the extracted primary and secondary D labels. It keeps the mapping from normalized labels to raw labels and paper IDs. A D category cannot appear in the aggregate merely because it exists in a predefined taxonomy. If D is unclear, retain `未报告` or an ambiguity note.

## Output contract

The user-facing legacy CSV can retain the eight paper-chain columns for compatibility:

```markdown
| 发表地方缩写/年份 | 论文标题 | Q | Δ | metric | baseline | ground truth | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
```

The normalized JSON and grouped snapshot must additionally preserve source provenance and paper-level D descriptors. The landscape outputs are:

- one synchronized row per unique paper in the CSV and JSON catalog;
- paper-level D evidence and raw-to-normalized D mappings;
- persistent manual grouping and ordering under `研究对象 → Q → Q细分`;
- cross-Q D counts linked to contributing paper IDs;
- `analysis/research-landscape-current.md`;
- `analysis/research-landscape-grouped.json`;
- `analysis/research-landscape-mindmap.md`;
- `analysis/research-landscape-mindmap.html`;
- `paper-library/research-landscape-mindmap.html`;
- `paper-library/research-landscape-mindmap.js`;
- a research-landscape PPT when the deliverable requires one.

The explicit `信息不全/不相干/重复` branch remains visible in the grouping page but is excluded from the research landscape and mindmap.

Report output paths, catalog and landscape counts, source types and evidence limits, Q/D classifications, D normalization rules, and the backup path. Do not claim that a page or PPT was updated unless the generated artifact and a basic load/render check succeeded.
