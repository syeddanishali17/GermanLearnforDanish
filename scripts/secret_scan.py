"""Secret scan for this public repo: full git history + staged changes + untracked-but-not-ignored files.

Checks generic secret patterns and the exact values of local secrets (.secrets/*, frontend/.dev.vars),
printing only counts, never values. Exit code 1 if anything real is found.

Usage (repo root): python scripts/secret_scan.py
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"test-password-123", "gate-test-token"}  # test fixtures in worker tests

PATTERNS = {
    "pbkdf2 hash": r"pbkdf2\$\d+\$[A-Za-z0-9+/=]{10,}\$",
    "argon2 hash": r"\$argon2id\$v=\d+\$m=\d+",
    "private key": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "AWS key": r"AKIA[0-9A-Z]{16}",
    "OpenAI/Anthropic key": r"\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}",
    "GitHub token": r"\bgh[pousr]_[A-Za-z0-9]{30,}",
    "Slack token": r"\bxox[abpr]-[A-Za-z0-9-]{10,}",
    "session cookie": r"ustad_session=[A-Za-z0-9_-]{20,}",
    "secret assignment": r"(?i)(?:secret|token|api[_-]?key|password)\s*[:=]\s*['\"]([^'\"\s]{12,})['\"]",
    "workers.dev URL": r"\b[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b",
}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace").stdout


def local_secret_values() -> list[tuple[str, str]]:
    """(file, value) pairs from local secret files. Private prose (.md, e.g. the real learner profile) is not a secret value."""
    vals = []
    for f in [*ROOT.glob(".secrets/*.txt"), ROOT / "frontend" / ".dev.vars"]:
        if f.is_file():
            for m in re.finditer(r"[:=]\s*\"?([^\s\"]{12,})", f.read_text(encoding="utf-8", errors="replace")):
                if not m.group(1).startswith("http"):
                    vals.append((f.name, m.group(1)))
    return vals


def main() -> int:
    untracked = git("ls-files", "--others", "--exclude-standard").split()
    blob = git("log", "-p", "--all", "--no-color") + git("diff", "--cached", "--no-color")
    for f in untracked:
        p = ROOT / f
        if p.suffix not in {".mp3", ".png", ".jpg"} and p.is_file():
            blob += p.read_text(encoding="utf-8", errors="replace")
    bad = 0
    for i, (name, v) in enumerate(local_secret_values(), 1):
        n = blob.count(v)
        bad += n
        print(f"local secret #{i} ({name}){'':<4} {n}")
    for name, pat in PATTERNS.items():
        hits = [h if isinstance(h, str) else h[0] for h in re.findall(pat, blob)]
        hits = [h for h in hits if not any(a in h for a in ALLOWED) and h not in ALLOWED]
        if name == "workers.dev URL":
            hits = [h for h in hits if not h.startswith(("ustad.<", "your-"))]
        bad += len(hits)
        print(f"{name:22} {len(hits)}")
    print("RESULT:", "FOUND SOMETHING, do not push" if bad else "clean")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
