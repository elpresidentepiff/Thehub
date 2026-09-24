# Rules for every agent on this repo

Claude, Codex or anyone else. Read this, then the constitution
(`.claude/skills/hub-experience/SKILL.md`), then `docs/plan/ROADMAP.md`.

## 1. One source of truth: GitHub, branch `develop`

- `origin` = `github.com/elpresidentepiff/Thehub` (private).
- **Work on `develop`.** `main` changes only when the operator merges.
- Two working copies exist. Both track `origin`; neither is special:
  - `~/Thehub` (WSL, `/home/purorpurorestrepo1981/Thehub`) — Node, Next.js, Postgres work.
    `node_modules` lives here.
  - `C:\Users\puror\Thehub` (Windows) — Codex and the static preview server.
- **`git pull` before you start. Commit and `git push` before you stop.** Never end a
  session with work only on disk. (On 23 Sep two agents each left a day's work
  uncommitted in different copies; it took an audit to reunite them.)

## 2. Where things go

| You are making… | Put it in | Not in |
| --- | --- | --- |
| Production UI / experience code | `src/experience/`, `src/app/` | `lab/` |
| Commerce logic (inventory, pricing, holds, Stripe mapping) | `src/commerce/` — pure, no React, no SVG | components |
| An experiment of any kind | `lab/<name>/` (static) or `src/app/lab/<name>/` (Next, dev-only) | `src/experience/` |
| Database schema | `supabase/migrations/NNNN_name.sql` + a test in `supabase/tests/` | ad-hoc SQL in the dashboard |
| Bookable desks/rooms (identity + geometry) | `data/inventory/*.json` | SVG colours, React constants |
| A plan, decision or status change | `docs/plan/ROADMAP.md` | a new top-level doc |
| A review, report or audit | `docs/reports/YYYY-MM-DD-<topic>.md` | the README |
| Research on a library/component | `docs/research/` + a row in `COMPONENT_REGISTRY.md` | `package.json` |

Update `docs/plan/ROADMAP.md` (status board + next actions) whenever you finish something.

## 3. Hard gates — do not cross without the operator

- **No Supabase project, table or migration applied to any remote database** until the
  operator approves `docs/commerce/SUPABASE_SCHEMA_PROPOSAL.md`. When approved, The Hub gets
  its **own** project. **Never use or touch any VELO Supabase project.**
- **No Stripe product, price, session or webhook** (test or live) until the operator
  approves `docs/commerce/STRIPE_OBJECT_MAPPING.md`. Never store raw card data.
- **No real prices** in code. Development prices live only in clearly-named dev config.
- **Mock availability never reaches production.** The mock provider throws outside dev.
- **Do not redesign the approved opening.** 1857 → gold line → cleat → the real walkthrough →
  WORK · MEET · CREATE · CONNECT · BELONG. Explore alternatives in `lab/` only.
- **Accent yellow is UNRESOLVED.** No accent token or provisional hex in `src/` or `tokens/`
  (the build fails if you add one).
- **No purchases** (React Bits Pro, Aceternity Pro, assets, HeyGen) without the operator.

## 4. Engineering rules (enforced by `npm run check` / `npm run build`)

- Production never imports lab code; lab may import production.
- One tweening engine per job (GSAP = scroll/story, Motion = UI physics). Lenis is the only
  scroll smoother. Theatre.js studio is dev-only.
- Component catalogues are a parts department: harvest one component, convert it to Hub
  tokens, record it in `docs/research/COMPONENT_REGISTRY.md`.
- The renderer is never the booking database. SVG/3D objects reference stable IDs
  (`L2-D001`, `L2-MR01`, `L2-OFFICE01`); availability and prices come from the server.

## 5. Before you stop

```bash
npm run check && npm test && npm run db:test   # whatever you touched
git add -A && git commit && git push
```

Then update the status board in `docs/plan/ROADMAP.md`, and say what you verified and what
you did not.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
