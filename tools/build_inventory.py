"""Build data/inventory/unit4-l2.json — the stable bookable-unit registry for Unit 4 L2.

The Rev B detector supplies the measured grid and reliable desk anchors. The main-office
layout is corrected from the operator's 28 Sep 2026 photographs: three three-seat banks
along the side wall and five two-seat banks in the centre. Rooms are read from the drawing's
own annotations and remain approximate (+/- 0.2 m) until the floor walk.

Identity rules (never break these):
  - An ID, once issued, is never reused or renumbered. Retire it with "retired": true.
  - IDs carry no meaning beyond floor + kind + number. Labels are for humans and may change.
  - Geometry and identity only. No prices, no availability, no occupants.

    python3 tools/build_inventory.py   # rewrites data/inventory/unit4-l2.json
"""
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
meta = json.loads((ROOT / 'assets/plan/plan_meta.json').read_text())
desks = json.loads(subprocess.run([sys.executable, str(ROOT / 'tools/detect_desks.py')],
                                  capture_output=True, text=True, check=True).stdout)


def rect(cx, cy, w, d, rot):
    """Corners of a w x d rectangle centred on (cx, cy), long axis at rot degrees."""
    a = math.radians(rot)
    ux, uy, vx, vy = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)
    pts = []
    for sw, sd in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        pts.append([round(cx + sw * w / 2 * ux + sd * d / 2 * vx, 3),
                    round(cy + sw * w / 2 * uy + sd * d / 2 * vy, 3)])
    return pts


def zone(d):
    x, y = d['x_m'], d['y_m']
    if x > 24 and y < 7.2:
        return 'acg'
    if x > 26 and y > 7.2:
        return 'iffys'
    if y < 5.5:
        return 'window'
    if y > 9:
        return 'corner'
    return 'centre'


by_zone = {}
for d in desks:
    by_zone.setdefault(zone(d), []).append(d)
expected = {'window': 8, 'centre': 6, 'corner': 2, 'acg': 6, 'iffys': 1}
counts = {k: len(v) for k, v in by_zone.items()}
if counts != expected:
    sys.exit(f'desk detection changed: {counts} != {expected}. Review before reissuing IDs.')

# The actual wall banks are not the four pairs proposed in Rev B. Each photographed bank is
# a compact T: two parallel desks, with chairs on their outside edges, and one horizontal desk
# across their room-facing ends with its own chair. These centres stay on the drawing's -9/81°
# grid and use the detector's proven 1.35 x 0.67 m desk size.
wall_banks = [
    ((12.599, 4.679), (13.265, 4.574), (13.082, 5.575)),
    ((16.343, 4.085), (17.009, 3.980), (16.826, 4.981)),
    ((20.087, 3.491), (20.753, 3.386), (20.570, 4.387)),
]

# Five photographed centre pairs. The middle three are detected Rev B rectangles; the outer
# two continue the same measured 1.775 m bay spacing and -9° drawing grid.
centre_pairs = [
    ((17.488, 6.755), (17.593, 7.420)),
    ((19.263, 6.473), (19.368, 7.138)),
    ((21.038, 6.191), (21.143, 6.857)),
    ((22.812, 5.909), (22.918, 6.575)),
    ((24.587, 5.628), (24.692, 6.294)),
]

units = []
n = 0
for bank in wall_banks:
    for position, (cx, cy) in enumerate(bank):
        n += 1
        rot = 81.0 if position < 2 else -9.0
        units.append({
            'id': f'L2-D{n:03d}',
            'space_id': 'L2-MAIN',
            'kind': 'desk',
            'label': f'Wall {n}',
            'capacity': 1,
            'x_m': cx, 'y_m': cy, 'rot_deg': rot,
            'footprint': rect(cx, cy, 1.35, 0.67, rot),
            'source': 'operator-corrected:photos-2026-09-28',
            'verified': False,
        })

for pair in centre_pairs:
    for cx, cy in pair:
        n += 1
        units.append({
            'id': f'L2-D{n:03d}',
            'space_id': 'L2-MAIN',
            'kind': 'desk',
            'label': f'Centre {n - 9}',
            'capacity': 1,
            'x_m': cx, 'y_m': cy, 'rot_deg': -9.0,
            'footprint': rect(cx, cy, 1.35, 0.67, -9.0),
            'source': 'operator-corrected:photos-2026-09-28',
            'verified': False,
        })

# Rooms: centre and size from the drawing's annotated dimensions; rotation from the wall grid.
rooms = [
    # id,           space,         kind,             label,                 cap, cx,    cy,    w,      d,      rot,  note
    ('L2-MR01',     'L2-MEET',     'meeting_room',   'Meeting room (small)', 4, 9.00,  7.30,  3.3151, 2.5575, -9.0, 'Drawing: MEETING ROOM 8.2 sqm, table for 4'),
    ('L2-MR02',     'L2-MEET',     'meeting_room',   'Meeting room (large)', 8, 19.10, 12.55, 4.7504, 3.6924, -9.0, 'Drawing: MEETING ROOM 17.6 sqm, table for 8'),
    ('L2-OFFICE01', 'L2-OFFICES',  'private_office', 'Private office 1',     6, 27.40, 3.80,  5.70,   5.2798, -9.0, "Drawing labels this 'ACG Offices' (6 desks). Existing tenant? Not bookable until the operator decides (ROADMAP D6)"),
    ('L2-OFFICE02', 'L2-OFFICES',  'private_office', 'Private office 2',     1, 28.70, 8.25,  4.40,   2.9704, -9.0, "Drawing labels this \"Iffy's OFFICE 12 sqm\" (1 desk drawn). Existing tenant? Not bookable until the operator decides (ROADMAP D6)"),
]
for rid, space, kind, label, cap, cx, cy, w, d, rot, note in rooms:
    tenant_question = kind == 'private_office'
    units.append({
        'id': rid, 'space_id': space, 'kind': kind, 'label': label, 'capacity': cap,
        'x_m': cx, 'y_m': cy, 'rot_deg': rot,
        'footprint': rect(cx, cy, w, d, rot),
        'source': 'rev-b:annotated',
        'verified': False,
        **({'bookable': False} if tenant_question else {}),
        'note': note,
    })

spaces = [
    {'id': 'L2-MAIN', 'kind': 'desk_zone', 'name': 'Main office', 'bookable': False},
    {'id': 'L2-MEET', 'kind': 'meeting_zone', 'name': 'Meeting rooms', 'bookable': False},
    {'id': 'L2-OFFICES', 'kind': 'office_suite', 'name': 'Private offices', 'bookable': False},
    {'id': 'L2-KITCHEN', 'kind': 'communal', 'name': 'Kitchen', 'bookable': False,
     'x_m': 14.90, 'y_m': 12.80, 'footprint': rect(14.90, 12.80, 3.7577, 3.8578, -9.0)},
    {'id': 'L2-PODS', 'kind': 'communal', 'name': 'Phone pods (2)', 'bookable': False,
     'x_m': 16.65, 'y_m': 8.00, 'footprint': rect(16.65, 8.00, 1.30, 2.90, -9.0)},
]

registry = {
    'floor': {
        'id': 'unit4-l2',
        'name': 'Unit 4, Second Floor',
        'plan_revision': 'rev-b',
        'plan_asset': 'assets/plan/floor_unit4_l2.svg',
        'units': 'metres',
        'width_m': meta['extent_m']['w'],
        'height_m': meta['extent_m']['h'],
    },
    'status': 'DRAFT: main-office grouping corrected from operator photographs on 28 Sep 2026; exact positions still require the floor walk.',
    'spaces': spaces,
    'units': units,
}
out = ROOT / 'data/inventory/unit4-l2.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(registry, indent=1) + '\n')
print(f'{out.relative_to(ROOT)}: {len(units)} units ({n} desks, {len(rooms)} rooms/offices), {len(spaces)} spaces')
