# Computer Research Landscape Pipeline

这是一个在论文已经下载、检索完成之后使用的计算机领域研究分析与可视化项目。它不负责搜索论文或下载论文；agent 只需要拿到 PDF、全文链接或摘要，并把提取结果写入本项目的数据文件。

项目入口规范：

- [研究版图 skill](privacy-policy-research-landscape/SKILL.md)
- [pipeline 合同](privacy-policy-research-landscape/references/pipeline.md)
- [单篇论文提取 skill](skills/paper-pdf-research-chain/SKILL.md)

## 快速使用

1. 将论文分析结果写入 `paper-library/data/papers.json`。
2. 为每篇论文保留稳定的 `id`，并写入八个研究链字段：

   `venueYear, title, Q, delta, metric, baseline, groundTruth, conclusion`

3. 额外写入论文级 `D`：

   ```json
   {
     "primary": "论文实际使用的主要方法路线",
     "secondary": ["其他重要方法"],
     "raw": "接近原文的描述",
     "evidence": ["Sec. 3", "Table 2"]
   }
   ```

4. 在 `paper-library/data/group-state.json` 中保存人工 Q 分组，或通过论文分组页面完成分组。
5. 安装运行依赖：

   ```powershell
   python -m pip install -r requirements.txt
   ```

6. 生成全部结果：

   ```powershell
   python tools/run_pipeline.py
   ```

   只生成 Markdown、JSON 和 mindmap：

   ```powershell
   python tools/run_pipeline.py --skip-ppt
   ```

## 输入格式

`paper-library/data/papers.json` 是主输入。示例记录：

```json
{
  "id": "paper-001",
  "venueYear": "NeurIPS 2025",
  "title": "论文完整标题",
  "Q": "论文研究的科学问题",
  "delta": "论文提出的方法和关键机制",
  "D": {
    "primary": "论文实际使用的主要方法路线",
    "secondary": ["辅助方法"],
    "raw": "接近论文原文的方法描述",
    "evidence": ["Sec. 3", "Table 1"]
  },
  "metric": "比较指标的定义、含义、方向和单位",
  "baseline": "实际参与实验的基线",
  "groundTruth": "评测数据、标签或参考目标",
  "conclusion": "结果、比较和有边界的结论",
  "source": {
    "type": "pdf",
    "location": "论文文件路径或全文 URL",
    "evidenceLimit": "full-text"
  }
}
```

来源优先级是：

`PDF → 全文链接 → 摘要`

只能拿到摘要时，必须把 `source.evidenceLimit` 写成 `abstract-only`，并把全文没有支持的字段写成 `未报告`。

`D` 必须从论文方法和实验中提取。聚合脚本不会根据标题、关键词、Q 或预设方向猜测 D。

## 分组页面

启动本地页面：

```powershell
Set-Location paper-library
python -m http.server 4173 --bind 127.0.0.1
```

打开 <http://127.0.0.1:4173/>。

页面支持搜索、论文详情、一级/二级分组、拖拽排序、移出分组和布局调整。浏览器中的分组状态保存在 localStorage；命令行构建器使用 `paper-library/data/group-state.json`。需要从页面状态生成文件时，保持两者同步。

## 产出

运行 pipeline 后生成：

- `analysis/research-landscape-current.md`：按 Q 展开的论文研究链和 D 汇总；
- `analysis/research-landscape-grouped.json`：分组、未分组论文、年份统计、论文级 D 和跨 Q D 聚合；
- `analysis/research-landscape-mindmap.md`：可读的层级 mindmap；
- `analysis/research-landscape-mindmap.html`：可搜索、可展开的 mindmap 页面；
- `paper-library/research-landscape-mindmap.html`：放在论文页面目录下的 mindmap；
- `analysis/research-landscape.pptx`：研究版图演示文稿；
- `validate_project.py` 的 JSON 验证结果。

## 工具目录

- `tools/common.py`：路径、JSON、分组、D 和来源处理；
- `tools/build_grouped_landscape_report.py`：生成 Markdown 和 grouped JSON；
- `tools/build_research_landscape_mindmap.py`：生成 Markdown/HTML mindmap；
- `tools/build_research_landscape_ppt.py`：生成通用 PPTX；
- `tools/validate_project.py`：验证 ID、分组、标题重复和 D 可追溯性；
- `tools/run_pipeline.py`：按顺序运行全部步骤；
- `paper-library/`：论文查看和人工分组页面；
- `skills/`：agent 使用的提取与版图规范。

`merged-papers.csv` 是给人查看的兼容快照；JSON 是构建器的主输入。历史快照如果存在，不参与 pipeline 运行。

## Agent 使用边界

把本仓库链接交给 agent 后，agent 可以完成：

- 阅读 PDF、全文链接或摘要；
- 写入规范化论文记录；
- 提取论文级 Q、Δ 和 D；
- 更新 Q 分组；
- 运行报告、mindmap、PPT 和验证脚本。

agent 不会在这个项目中搜索或下载论文，也不会把未被来源支持的信息填入论文记录。
