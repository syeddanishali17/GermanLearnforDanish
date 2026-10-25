"""Split SPEC.md into focused docs/spec/*.md files so phase sessions read only what they need.

Run again after editing SPEC.md:  python scripts/split_spec.py
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
GROUPS = {
    "01_mission_learner.md": [1, 2],
    "02_pedagogy_daily_loop.md": [3, 4],
    "03_modules.md": [5],
    "04_engagement_progress.md": [6, 7],
    "05_architecture.md": [8],
    "06_llm_tutor.md": [9],
    "07_data_model.md": [10],
    "08_content_privacy_cost.md": [11, 12],
    "09_phases_claude.md": [13, 14, 15, 16],
    "10_sources.md": [17],
}


def main() -> None:
    text = (ROOT / "SPEC.md").read_text(encoding="utf-8")
    parts = re.split(r"(?m)^(?=## \d+\. )", text)
    sections = {}
    for part in parts:
        m = re.match(r"## (\d+)\. ", part)
        if m:
            sections[int(m.group(1))] = part.rstrip().rstrip("-").rstrip() + "\n"
    out = ROOT / "docs" / "spec"
    out.mkdir(parents=True, exist_ok=True)
    for name, nums in GROUPS.items():
        body = "\n\n".join(sections[n] for n in nums)
        header = f"<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->\n\n"
        (out / name).write_text(header + body, encoding="utf-8")
    print(f"wrote {len(GROUPS)} files to {out}")


if __name__ == "__main__":
    main()
