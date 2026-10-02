"""Run the local research-landscape report, mindmap, PPT, and validation steps."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"


def run(name: str) -> None:
    command = [sys.executable, str(TOOLS / name)]
    print(f"[pipeline] {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the research-landscape outputs from local paper JSON and group state.")
    parser.add_argument("--skip-ppt", action="store_true", help="只生成 Markdown、JSON 和 mindmap，不生成 PPTX")
    parser.add_argument("--skip-validation", action="store_true", help="跳过验证步骤")
    args = parser.parse_args()
    run("build_grouped_landscape_report.py")
    run("build_research_landscape_mindmap.py")
    if not args.skip_ppt:
        run("build_research_landscape_ppt.py")
    if not args.skip_validation:
        run("validate_project.py")
    print("[pipeline] 完成")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
