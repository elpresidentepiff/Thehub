# The Hub at Lloyds Wharf

2 Mill Street, SE1 2BD — a Victorian wharf warehouse in Shad Thames, est. 1857, now a workspace.

This repo holds the digital experience (the opening sequence, the floor, the seat picker) and
the commerce engine behind it (inventory, availability, holds, booking, Stripe).

## Start here

| Read | Why |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Rules for every agent (Claude, Codex): branch, where things go, hard gates |
| [`.claude/skills/hub-experience/SKILL.md`](.claude/skills/hub-experience/SKILL.md) | **The constitution** — brand, materials, type, motion, stack boundaries. Load before any work |
| [`docs/plan/ROADMAP.md`](docs/plan/ROADMAP.md) | **The plan** — status board, milestones, next actions, decisions owed by the operator |
| [`docs/README.md`](docs/README.md) | Index of every other document |

## What is where

| Path | What it is | Ships to production? |
| --- | --- | --- |
| `src/app/` | Next.js routes. `/` is the opening | yes |
| `src/experience/` | Opening sequence, spatial stage (Canvas 2D → R3F), motion runtime, perf | yes |
| `src/commerce/` | Commerce engine: inventory, availability, pricing, holds, Stripe mapping. Renderer-independent | yes (server) |
| `src/app/lab/`, `src/lab/` | Next.js dev-only lab routes. Never imported by production (build fails if so) | no |
| `supabase/` | Hub database: migrations, SQL tests. **Local only — no Supabase project exists yet** | when approved |
| `data/inventory/` | Stable bookable-unit registry (IDs + metric geometry). No prices, no availability | yes (seed) |
| `proto/` | Milestone 1 zero-dependency opening prototype — the approved narrative reference | no |
| `lab/` | Static zero-build studies (opening tests, floor/booking/checkout mocks, cleat studies) | no |
| `assets/` | Brand photos, `cleat.svg`, the metric plan, web video. `assets/plan/source/` = Rev B PDF + raw segments | via `public/` |
| `tokens/` | Design tokens (CSS + JSON), measured from real photography | yes |
| `tools/` | PDF → metric plan extraction, desk detection | no |
| `scripts/` | Build guards (`check-boundaries`, `check-bundle`), media sync, test runners | no |
| `docs/` | Plan, experience, commerce, research, reports — see `docs/README.md` | no |

Outside git: `/mnt/c/Users/puror/lloyds-wharf-hub/` holds the 113 walkthrough stills and the
original extraction workspace.

## Run it

Node work happens in the WSL checkout (`~/Thehub`) where `node_modules` lives.

```bash
npm install
npm run dev            # Next.js on :3000 — the production opening at /
npm run check          # constitution boundaries + typecheck
npm test               # commerce engine unit tests
npm run db:test        # migrations + SQL tests against a throwaway local Postgres
npm run build          # prebuild guards → build → postbuild bundle proof
```

Static studies need no build — serve the repo root and open the paths:

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080/proto/opening.html
# http://127.0.0.1:8080/lab/floor/
```

## Three facts the brand rests on

1. **EST. 1857** — cast into the entrance wall. Not 1859.
2. **The mark is a mooring cleat** — a wharf fitting. *Things dock here.*
3. **The River Neckinger runs underneath**, to St Saviour's Dock. Water is never
   decorative on this project.

## The floor plan is live geometry

`assets/plan/floor_unit4_l2.svg` was extracted from the architect's Rev B drawing —
1,345 lines and 1,240 curves, scale confirmed at **1:50 (56.69 pt/m)** against the
annotated 1.2 m desks. Drawing extent is **31.71 m × 18.44 m**.

The viewBox is **in metres**. Seat coordinates, camera paths and wall extrusion all share
that one coordinate system. Never introduce a second.
