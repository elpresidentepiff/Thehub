#!/usr/bin/env python3
"""Turn the walkthrough stills into web-sized frames for the living-site lab.

    python3 tools/build_walk.py --src /path/to/folder/with/still_001.jpg ...

The 113 stills (720x1280, 2 fps from the 56 s walkthrough) are not in this repo; they live in the older
`lloyds-wharf-hub/assets/video` copy. This writes assets/walk/w_001.webp ... plus assets/walk/walk.json
(frame count and size). Real Lloyds Wharf frames only, resized and re-encoded, nothing generated.
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "walk"
W, H, Q = 540, 960, 70


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, required=True)
    src = ap.parse_args().src
    stills = sorted(src.glob("still_*.jpg"))
    if not stills:
        raise SystemExit(f"no still_*.jpg in {src}")
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("w_*.webp"):
        old.unlink()
    total = 0
    for i, f in enumerate(stills, 1):
        im = Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS)
        p = OUT / f"w_{i:03d}.webp"
        im.save(p, "WEBP", quality=Q, method=6)
        total += p.stat().st_size
    meta = {"frames": len(stills), "width": W, "height": H, "pattern": "w_{n}.webp", "digits": 3,
            "source": "2 fps stills from the 56 s portrait walkthrough"}
    (OUT / "walk.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(stills)} frames, {total / 1e6:.1f} MB, to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
