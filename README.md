# The Hub at Lloyds Wharf

2 Mill Street, SE1 2BD — a Victorian wharf warehouse in Shad Thames, est. 1857, now a workspace.

This repo holds the digital experience: the opening sequence, the floor, the seat picker,
and eventually booking.

## Read this first

**`.claude/skills/hub-experience/SKILL.md`** is the project constitution — brand, materials,
type, motion, stack boundaries and prohibitions. Load it before writing any code, copy,
colour or scene. It carries measured values, not preferences.

`docs/BUILD_PLAN.md` is the phased plan and the open decisions.

## What is here

| Path | Contents |
| --- | --- |
| `.claude/skills/hub-experience/` | the constitution — load before any work |
| `tokens/` | design tokens, CSS + JSON, all measured from real photography |
| `assets/brand/` | the lit sign, the cleat wall, the Neckinger sign, `cleat.svg` |
| `assets/plan/` | `floor_unit4_l2.svg` (viewBox in **metres**) + `plan_meta.json` |
| `assets/video/` | web-encoded clips + poster from the walkthrough |
| `proto/opening.html` | the opening sequence prototype — zero dependencies |
| `tools/` | the PDF extraction scripts, re-runnable on a new drawing |
| `docs/` | build plan |

## The prototype

`proto/opening.html` is the first 40 seconds: 1857 → the cleat lit by its own halo →
THE HUB with real footage inside the letters → push through → arrival on the floor.

It is deliberately dependency-free — vanilla scroll-driven, no GSAP, no Lenis, no build
step — so the choreography can be judged on its own before the production stack goes in.
Open the file directly, or serve the folder:

```bash
python3 -m http.server -d proto 8080
```

In production this sequence is rebuilt on GSAP ScrollTrigger + Lenis, with the camera
choreography authored in Theatre.js and exported as state JSON.

## Three facts the brand rests on

1. **EST. 1857** — cast into the entrance wall. Not 1859.
2. **The mark is a mooring cleat** — a wharf fitting. *Things dock here.*
3. **The River Neckinger runs underneath**, to St Saviour's Dock. Water is never
   decorative on this project.

## The floor plan is live geometry

`assets/plan/floor_unit4_l2.svg` was extracted from the architect's Rev B drawing —
1,345 lines and 1,240 curves, scale confirmed at **1:50 (56.69 pt/m)** against the
annotated 1.2 m desks. Floorplate is **31.71 m × 18.02 m**.

The viewBox is **in metres**. Seat coordinates, camera paths and wall extrusion all share
that one coordinate system. Never introduce a second.
