#!/usr/bin/env python3
"""Generate pricing/pricing.js from pricing/pricing.json.

pricing.json is the single source. pricing.js exists only so static pages (proto/, lab/) can read the
same numbers over file:// without fetch. Never edit pricing.js by hand.

    python3 tools/build_pricing_js.py            # write pricing/pricing.js
    python3 tools/build_pricing_js.py --check    # exit 1 if pricing.js is stale
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pricing" / "pricing.json"
OUT = ROOT / "pricing" / "pricing.js"


def render() -> str:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    body = json.dumps(data, indent=2, ensure_ascii=False)
    return (
        "/* GENERATED from pricing/pricing.json by tools/build_pricing_js.py. Do not edit. */\n"
        f"window.HUB_PRICING = {body};\n"
    )


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("pricing/pricing.js is stale: run tools/build_pricing_js.py", file=sys.stderr)
            return 1
        print("pricing/pricing.js is in sync")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
