# The Hub — Roadmap

The single living plan. Update the status board and next actions whenever work lands.
`BUILD_PLAN.md` beside this file is the original rationale (22 Sep) and still holds.

Last updated: 2026-09-24.

---

## Status board

| Area | State | Evidence | Blocked on |
| --- | --- | --- | --- |
| Opening narrative | **Approved:** EST. 1857 → gold line → cleat → real walkthrough → WORK · MEET · CREATE · CONNECT · BELONG. HUB-letters photo beat **cut** on operator request (23 Sep) | `proto/opening.html` | — |
| Cleat | Operator: "cool, but we can do more". Current liquid pass reads as shaky, not liquid | `lab/cleat-studies/` | Operator choice of direction |
| Opening tests A/B/C | **Rejected** ("good attempt but not looking cool"). Kept as evidence only | `lab/opening-tests/` | — |
| Production opening (Next.js) | **Synced to the approved prototype 24 Sep:** HUB-letters beat removed; the camera now pushes through the cleat (prototype timings, dolly ×4.8); build + camera test pass; frame-compared with `proto/opening.html` | `src/experience/opening/` | Cleat choice (D2) and logo (D1) slot into the same beat |
| Logo / opening-shot design | **Operator deciding** | — | Operator |
| Inventory registry | Draft from Rev B: 16 open-plan desks, 2 meeting rooms, 2 private offices. **Not yet walked on site** | `data/inventory/unit4-l2.json` | Floor walk; ACG/Iffy's decision |
| Database schema | Migrations written and tested on a throwaway local Postgres (no-overlap proven under concurrency). **No Supabase project exists** | `supabase/` | Operator approval of schema proposal |
| Commerce engine | Pure TypeScript, 26 tests (`npm test`): dev-only catalogue, London-time periods, quotes, hold tokens + DB refusal map, Stripe Checkout params, webhook signature check + reducer, mock availability that throws outside development. `check-boundaries` keeps it free of React/renderer imports | `src/commerce/` | — |
| Stripe | Mapping proposed. **Nothing created** in Stripe | `docs/commerce/STRIPE_OBJECT_MAPPING.md` | Approval + prices |
| Floor picker (lab) | `/lab/floor` in `npm run dev`: real plan + registry + engine; map (keyboard: arrows) and list (touch); server quotes; 404 in production. **Styling is a first pass** — operator wants it in the floor's own look (video + new floor photos coming) | `src/app/lab/floor/` | Operator's floor video/photos |
| Static commerce mocks | Floor → booking → checkout click-through; invented desk positions | `lab/floor`, `lab/booking`, `lab/checkout` | Floor superseded by `/lab/floor`; booking/checkout still static |

---

## Milestones

| # | Milestone | State |
| --- | --- | --- |
| M1 | Foundation: constitution, measured tokens, metric plan, cleat SVG, opening prototype | **Done** (`da4f01e`) |
| M2 | Production opening on the locked stack (Next.js, GSAP + Lenis, R3F, Theatre state, reduced motion, WebGL fallback, perf) | **Built** (`d2f7668`); waits for opening-shot decision, then sync to the approved prototype |
| M3 | Unit 4 spatial EXPLORE: camera rises from the floor into the measured plan; plan ↔ video binding | Not started; after M2 passes review |
| C1 | Commerce foundations (parallel to M2/M3): inventory IDs, schema, engine, dev lab routes | **In progress** — see below |
| C2 | Hub Supabase project + Stripe test mode | Gated on operator approval |
| C3 | Live booking in test mode: hold → Checkout → webhook → confirmed → floor updates in realtime | After C2 |
| C4 | Real catalogue, memberships, go-live | Needs real prices and rules |

### C1 — commerce foundations (this workstream)

| Step | Delivers | State |
| --- | --- | --- |
| C1.1 | `data/inventory/unit4-l2.json` — stable IDs placed on real Rev B geometry | Draft done; needs floor walk |
| C1.2 | `supabase/migrations` — `hub` / `private` / `api` schemas, exclusion-constraint no-overlap, holds, RLS, grants | Done locally; `npm run db:test` |
| C1.3 | `src/commerce` — engine + unit tests; mock availability that cannot run in production | Done 24 Sep; `npm test` (the 23 Sep board said done before the tests existed) |
| C1.4 | `src/app/lab/floor` — the real plan + registry + engine, touch/keyboard states | Built 24 Sep (Playwright-checked desktop + phone); restyle to the floor's look pending |
| C1.5 | Seat authoring tool (BUILD_PLAN §2): place/nudge/name seats on the plan, export registry | Next |

---

## Next actions, in order

1. **Operator:** pick the logo and opening-shot direction; pick a cleat direction
   (`lab/cleat-studies/`).
2. **Operator:** answer the commerce questions below. They unblock C2.
3. Restyle `/lab/floor` in the floor's own look from the operator's video and new photos; then
   link the end of the opening (the walkthrough) into it so the site is one journey.
4. C1.5 seat authoring tool; then walk the floor with it and mark the registry `verified`.
5. When a cleat study is chosen (D2): build it into `proto/opening.html` first, then `src/experience/opening`.
6. After approval: create the dedicated Hub Supabase project, apply migrations, run the SQL
   tests against it, create `DEV — Hub` test-mode Stripe products.

---

## Decisions owed by the operator

### Blocking now

| # | Decision | Unblocks |
| --- | --- | --- |
| D1 | Logo + opening-shot design | M2 sync |
| D2 | Cleat direction: pick one of the four studies in `lab/cleat-studies/` (1 rope, 2 pour, 3 halo sign, 4 iron over the Neckinger) | Opening |
| D3 | Approve the Supabase schema proposal (or amend) | C2 |
| D4 | Approve the Stripe object mapping (or amend) | C2 |
| D5 | Can visitors book anonymously, or sign in first? | Hold ownership, RLS |
| D6 | Are the ACG and Iffy's offices on the drawing existing tenants (not bookable)? | Inventory |

### Needed before real sales

| # | Decision |
| --- | --- |
| D7 | Price list: day pass, hot desk, dedicated desk, meeting rooms (per hour / half / full day), offices, events, memberships. VAT included in displayed price? |
| D8 | Hold duration while a visitor is in Checkout (default proposal: 10 minutes) |
| D9 | Buffers between meeting-room bookings; opening hours; how far ahead people can book; can today's day pass be bought after opening? (the engine currently refuses once the day is more than one slot old) |
| D10 | Which products are self-serve vs enquiry-only (offices, events) |
| D11 | Cancellation and refund rules |
| D12 | Accent yellow: a RAL code or a daylight photograph of a pedestal |
| D13 | Five-word canon is WORK · MEET · CREATE · CONNECT · BELONG (M2 brief) — confirm, then the constitution's "unresolved" note is removed |

### Spending (hold until asked)

React Bits Pro / Aceternity Pro, 3D/PBR asset library, 21st.dev MCP connection,
Lloyds Wharf Gaussian-splat capture, landscape reshoot. HeyGen stays on hold until a concierge
can query real inventory.

---

## Parallel workstreams

```text
Experience ── 1857 → gold line → cleat → walkthrough → INSIDE ──┐
                                                                ├── meet at stable IDs + metric plan
Product ───── floor picker → inventory → availability → hold ───┘
              → basket → Stripe → webhook → booking → confirmation
```

The booking system never depends on the cinematic transition or the spatial renderer. The
opening can change freely without touching commerce, and the reverse.
