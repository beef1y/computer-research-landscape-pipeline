---
name: paper-pdf-research-chain
description: Extract a paper's scientific question, proposed method, paper-level D method descriptor, comparison parameters and their meanings, baselines, evaluation data or ground truth, and metric-based conclusions from a PDF or full-text source into a Markdown table. If full text is unavailable, use the abstract with an explicit evidence limit. Use for the Q → Delta → D → metric → baseline → ground truth → conclusion chain; do not use for full literature reviews, paper writing, or generic PDF summarization.
---

# Extract the Paper Research Chain

Use the supplied paper PDF or full-text source as the primary source. If neither is available, use the abstract only and mark unsupported fields as `未报告`. First extract the paper's basic information, then reconstruct its empirical argument in this order:

```text
发表地方缩写/年份 -> 论文标题 -> Q -> Δ -> D -> metric -> baseline -> ground truth -> 结论
```

The bundled reference [programmable-research.md](references/programmable-research.md) motivates the Q/Delta/metric vocabulary. For this skill, extract the chain from an already completed paper; do not invent the broader Gamma/Omega research process or propose new research directions unless the user separately asks for them.

## Field Definitions

| Field | Extract | Do not confuse it with |
| --- | --- | --- |
| `发表地方缩写/年份` | The publication venue abbreviation and publication year, such as `NeurIPS 2024`, `ACL 2023`, `IEEE S&P 2025`, or `arXiv 2024` when it is only a preprint. Use the venue/year explicitly supported by the PDF. | The authors' affiliation year, dataset release year, submission year, or a venue inferred from an external citation. |
| `论文标题` | The paper's full title as printed in the PDF. Preserve the authors' wording and capitalization where practical. | A shortened running title, filename, section heading, or your own translated title. |
| `Q` | The scientific question the paper investigates: what phenomenon, limitation, or capability is being explained, measured, predicted, or solved? Phrase it as a question or a precise problem statement. | A generic task label such as “image classification,” the paper title, or a broad application area. |
| `Δ` | The paper's new method, model, algorithm, framework, dataset construction, or experimental intervention proposed to address `Q`. Include the distinctive mechanism or design choice that makes it new in this paper. | Every implementation detail, a standard backbone, or an unsupported claim that the method is globally novel. |
| `metric` | The comparison parameters used to judge the method, including each parameter's name, definition, meaning, measurement target, unit or scale, and direction when relevant (`higher/lower is better`). Include task-specific, efficiency, robustness, or statistical parameters when they are actually used for comparison. Do not put experimental results in this cell. | A loss used only for training, an ablation variable, a metric mentioned only in related work, or any `ours/baseline = value` result. |
| `baseline` | The competing methods, standard systems, prior work, or simple reference methods actually compared against in the experiments. Group them by meaningful category when useful. | Ground-truth labels, an oracle, or methods cited but not evaluated. |
| `ground truth` | The evaluation data used as the reference for comparison: dataset/corpus name, split or test set, labels, annotations, measurements, simulator reference, or human judgments. Follow the user's convention that the dataset/data used for comparison belongs here; add the gold/reference target when the paper specifies one. | The baseline method, the training data when it is not the evaluation reference, or a claim that the dataset itself is a gold label. |
| `结论` | The reported results for the `metric` parameters and the conclusions drawn from them. State the proposed method's values, comparison with baselines or ground truth, winning/losing/tied outcome, important numbers, and limitations or scope conditions when reported. | A metric definition without a result, or a stronger generalization, causal explanation, or practical recommendation not supported by the paper. |

## Paper-level D extension

For the research-landscape pipeline, extract a paper-level `D` after `Δ`. D is the concrete method route actually used in the paper, stated close to the authors' wording and grounded in the method and evaluation sections. It is not a category selected from a preset taxonomy.

Store D as pipeline metadata with:

- `primary`: the main method route;
- `secondary`: additional materially used routes, when present;
- `raw`: wording close to the source;
- `evidence`: page, section, table, or figure locations;
- `normalized`: filled only later when an explicit synonym rule is applied.

If the source does not support a method descriptor, use `未报告`. The standalone eight-column Markdown output below remains unchanged for compatibility; the normalized JSON used by the landscape pipeline must retain D and its evidence.

## Extraction Workflow

1. Read the title, abstract, introduction, contributions, method, experiment setup, tables/figures, results, discussion, and conclusion. Use the appendix or supplementary material when it defines the evaluation data or metrics. If only the abstract is available, extract only abstract-supported facts and record the limitation.
2. If ordinary text extraction drops equations, table structure, captions, or footnotes, inspect the rendered PDF pages or use the available PDF-reading workflow before deciding that information is absent.
3. Build an internal evidence map for each field with the exact page, section, table, or figure location. Evidence locations may be included compactly inside table cells, for example `（Sec. 3, p. 5）`, but do not add a separate prose explanation unless requested.
4. Resolve the chain in order. `Δ` must answer `Q`; paper-level `D` must describe the concrete method route evidenced by the paper; `metric` must define the actual comparison parameters; `baseline` must be an evaluated comparator; `ground truth` must identify the reference data; and `结论` must report the metric results and derive the bounded conclusion from the comparison.
5. Prefer the authors' explicit wording, equations, tables, and captions over inferences from the abstract. When the paper is ambiguous, state the narrowest defensible interpretation.

## Evidence Rules

- Never fill a missing field from outside knowledge or from a cited paper unless the user asks for a multi-paper comparison.
- Use `未报告` when the paper does not provide the requested information. Use `不适用` only when the field genuinely does not apply to the task.
- Do not treat a dataset name alone as ground truth if the paper evaluates against human labels, measured values, reference trajectories, or another target; include both when available.
- Preserve distinctions among training, validation, and test data. For `ground truth`, prioritize the test/evaluation split and its reference target.
- Put metric names, definitions, meanings, units/scales, and direction in `metric`; put all observed values, baseline comparisons, rankings, and result interpretation in `结论`.
- Report results with their units, split, and direction in `结论` when the paper provides them. Do not recompute or rank results unless the paper makes the comparison clear; if a ranking requires an inference, label it as such.
- Never put `ours = ...`, `baseline = ...`, numerical scores, percentage improvements, or “outperforms” statements in `metric`. A metric cell answers “what is compared and what does it mean?”; a conclusion cell answers “what result was obtained and what follows from it?”
- For multiple metrics, baselines, datasets, or experiments, use `<br>` within one cell. Escape literal pipe characters as `\|` so the Markdown table remains valid.
- Separate the paper's reported result from interpretation. A statement such as “improves robustness” is allowed only when the relevant robustness metric or experiment supports it.
- Keep uncertainty visible with qualifiers such as `仅在测试集上`, `仅依据摘要`, `在某一数据集上`, `统计显著性未报告`, or `作者声称` when those limits matter.
- Do not create a paper-level D from a venue, title keyword, application area, or a preset research-direction list; extract it from the method evidence.

## Output Contract

Return a Markdown table and no surrounding essay by default. Use exactly these columns, in this order:

```markdown
| 发表地方缩写/年份 | 论文标题 | Q | Δ | metric | baseline | ground truth | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... | ... | ... | ... |
```

Use the symbol `Δ` in the header to match the user's notation. The content may remain Chinese when the user's request is Chinese; otherwise follow the user's language. For a single paper, normally output one row for the principal proposed method. If materially different variants have separate evaluations, output one row per variant and repeat the shared `Q`, evaluation data, and relevant metrics as needed.

Within each cell, favor concise, information-dense phrases:

- `发表地方缩写/年份`: `NeurIPS 2024`；若仅为预印本则写 `arXiv 2024`；若 PDF 未报告则写 `未报告`。
- `论文标题`: 论文 PDF 中的完整标题。
- `Q`: “在 X 条件下，现有方法为何/如何无法 Y？”
- `Δ`: “提出 A，通过 B 机制解决 C；关键组件：D。”
- `metric`: “M：衡量预测结果与参考标签之间的一致性，越高表示越准确；N：衡量模型推理耗时，单位为 ms，越低越好。”
- `baseline`: “B1（类别）；B2（类别）；简单基线 …。”
- `ground truth`: “数据集/语料：…；评估划分：…；参考标签/测量：…。”
- `结论`: “M：ours = …，优于 …；N：ours = …，低于 …；因此在该测试集上方法在准确性/效率方面表现更好，但 … 未报告/仍受限。”

Do not add a “摘要” column, a free-form takeaway, or a second table unless the user explicitly requests it.
