"""Find the standard 1200 x 600 desks in the Rev B segments.

Reads assets/plan/source/segs_raw.json (PDF points, y down) and plan_meta.json, and prints
every desk rectangle it can prove: two parallel 1.2 m edges, 0.6 m apart, ends aligned.
Output is metric (plan metres, same origin as floor_unit4_l2.svg).

This seeds data/inventory; it does not replace the floor walk. A person confirms every desk.

    python3 tools/detect_desks.py > /tmp/desks.json
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
meta = json.loads((ROOT / 'assets/plan/plan_meta.json').read_text())
segs = json.loads((ROOT / 'assets/plan/source/segs_raw.json').read_text())
PPM = meta['pt_per_metre']
OX, OY = meta['pdf_origin_pt']['x'], meta['pdf_origin_pt']['y']

# Two desk families are drawn: 1.20 x 0.60 (ACG, Iffy's) and 1.35 x 0.67 (main office,
# where the 1.2000 dimension line sits inside a larger drawn block). Both are 2:1.
LONG_MIN, LONG_MAX, TOL = 1.15, 1.40, 0.035


def metric(s):
    return ((s[0] - OX) / PPM, (s[1] - OY) / PPM, (s[2] - OX) / PPM, (s[3] - OY) / PPM)


def length(s):
    return math.hypot(s[2] - s[0], s[3] - s[1])


def angle(s):
    return math.degrees(math.atan2(s[3] - s[1], s[2] - s[0])) % 180


edges = [metric(s) for s in segs]
longs = [e for e in edges if LONG_MIN < length(e) < LONG_MAX]

desks = []
for i, a in enumerate(longs):
    for b in longs[i + 1:]:
        da = abs(angle(a) - angle(b))
        if min(da, 180 - da) > 2.5:
            continue
        # unit direction of a, and the perpendicular offset of b's midpoint from a's line
        ux, uy = (a[2] - a[0]) / length(a), (a[3] - a[1]) / length(a)
        mbx, mby = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        perp = abs((mbx - a[0]) * -uy + (mby - a[1]) * ux)
        if abs(length(a) - length(b)) > TOL or abs(perp - length(a) / 2) > TOL:
            continue
        # ends aligned: b's midpoint projects onto a's midpoint
        along = (mbx - a[0]) * ux + (mby - a[1]) * uy
        if abs(along - length(a) / 2) > 0.08:
            continue
        cx = (a[0] + a[2] + b[0] + b[2]) / 4
        cy = (a[1] + a[3] + b[1] + b[3]) / 4
        rot = math.degrees(math.atan2(uy, ux))
        rot = (rot + 90) % 180 - 90  # long axis, normalised to (-90, 90]
        desks.append({'x_m': round(cx, 3), 'y_m': round(cy, 3), 'rot_deg': round(rot, 1),
                      'w_m': round(length(a), 2), 'd_m': round(perp, 2)})

unique = []
for d in desks:
    if all(math.hypot(d['x_m'] - u['x_m'], d['y_m'] - u['y_m']) > 0.2 for u in unique):
        unique.append(d)
unique.sort(key=lambda d: (round(d['y_m']), d['x_m']))
json.dump(unique, sys.stdout, indent=1)
print(f'\n{len(unique)} desks', file=sys.stderr)
