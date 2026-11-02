#!/usr/bin/env python3
"""Build the deployable static site from proto/opening.html.

The prototype lives in proto/ and reaches ../assets and ../pricing. A host serves one folder, so this
flattens those paths into dist/ (git-ignored):

    dist/index.html
    dist/pricing.js
    dist/assets/video/arrive.mp4
    dist/assets/video/arrive_poster.jpg

    python3 tools/build_dist.py                          # write dist/
    python3 tools/build_dist.py --artifact-out FILE      # also write a claude.ai Artifact preview page

The Artifact page has no doctype/html/head/body (the host wraps it) and inlines pricing.js; the video
is still published beside it as assets/video/arrive.mp4.
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "proto" / "opening.html"
DIST = ROOT / "dist"
ASSETS = ["assets/video/arrive.mp4", "assets/video/arrive_poster.jpg"]


def flatten(html: str) -> str:
    html = html.replace('src="../pricing/pricing.js"', 'src="pricing.js"')
    html = html.replace("../assets/", "assets/")
    if "../" in re.sub(r"<!--.*?-->", "", html, flags=re.S).replace("pricing/pricing.json", ""):
        raise SystemExit("build_dist: a ../ path is left in the page, add it to ASSETS and flatten it")
    return html


def build_dist() -> str:
    subprocess.run([sys.executable, str(ROOT / "tools" / "build_pricing_js.py")], check=True, capture_output=True)
    if DIST.exists():
        shutil.rmtree(DIST)
    html = flatten(SRC.read_text(encoding="utf-8"))
    (DIST).mkdir()
    (DIST / "index.html").write_text(html, encoding="utf-8")
    shutil.copy(ROOT / "pricing" / "pricing.js", DIST / "pricing.js")
    for a in ASSETS:
        (DIST / a).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / a, DIST / a)
    print(f"wrote dist/ ({sum(f.stat().st_size for f in DIST.rglob('*') if f.is_file()) / 1e6:.1f} MB)")
    return html


def build_artifact(html: str, out: Path) -> None:
    pricing = (ROOT / "pricing" / "pricing.js").read_text(encoding="utf-8")
    page = html.replace('<script src="pricing.js"></script>', "<script>\n" + pricing + "</script>")
    page = re.sub(r"<!doctype html>\s*", "", page, flags=re.I)
    page = re.sub(r'<html[^>]*>\s*<head>\s*', "", page)
    page = re.sub(r'<meta charset="utf-8">\s*', "", page)
    page = re.sub(r'<meta name="viewport"[^>]*>\s*', "", page)
    page = re.sub(r"</head>\s*<body>\s*", "", page)
    page = re.sub(r"\s*</body>\s*</html>\s*$", "\n", page)
    page = page.replace("<title>The Hub at Lloyds Wharf</title>", "<title>Hub at Lloyds Wharf</title>")
    # single dark look: tell form controls and scrollbars, and keep the ground explicit
    page = page.replace("<style>", "<style>\n:root{color-scheme:dark}", 1)
    for tag in ("<html", "<head", "<body", "<!doctype"):
        if tag in page.lower():
            raise SystemExit(f"build_dist: {tag} left in the Artifact page")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"wrote {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact-out", type=Path)
    args = ap.parse_args()
    html = build_dist()
    if args.artifact_out:
        build_artifact(html, args.artifact_out)


if __name__ == "__main__":
    main()
