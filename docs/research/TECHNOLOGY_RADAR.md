# The Hub technology radar

Last reviewed: 23 September 2026.

This document gives Claude and other contributors a map of tools worth researching. It is
not a dependency list and it is not permission to install, purchase or copy anything.

The project constitution remains authoritative. Nothing enters production without a named
job, licence check, implementation owner, performance budget and fallback.

## Status definitions

| Status | Meaning |
| --- | --- |
| Foundation | Intended production responsibility; still pin and verify the exact version before implementation |
| Harvest | Search for an individual source-owned component; adapt and register it rather than installing a visual identity |
| Lab | Isolated research only; must beat the existing implementation against stated gates |
| Hold | Potential future value but no current job |
| Reject | Conflicts with the architecture or duplicates an existing responsibility |

## Production foundations

| Tool | Status | Named responsibility | Guard |
| --- | --- | --- | --- |
| Next.js / React / TypeScript | Foundation | Application, routing, rendering and typed product UI | Server-render content by default; isolate browser-heavy scenes |
| Tailwind | Foundation | Utility styling around Hub tokens | Tokens remain the source of colour/type/motion truth |
| shadcn/ui + Radix | Foundation | Accessible dialogs, popovers, comboboxes and foundational controls | Do not hand-roll already-solved accessible primitives |
| GSAP + ScrollTrigger | Foundation | Story and scroll choreography | One tweening engine per job |
| Lenis | Foundation | Sole scroll-smoothing layer | Never combine with ScrollSmoother |
| Motion | Foundation | UI physics and gestures | Does not own scroll-story choreography |
| Three.js / React Three Fiber / Drei | Foundation when spatial work begins | Spatial renderer and scene graph | No second WebGL renderer/context for the same shot |
| Theatre.js | Foundation when camera authoring begins | Camera, light and scene-property direction | Studio is development-only; production ships core plus exported state |
| Supabase | Foundation when product work begins | Postgres, auth, authorised realtime and operational state | Migrations and RLS tests are mandatory; no service key in the browser |
| Stripe | Foundation when commerce begins | Payments and subscriptions | Stripe is authoritative for money; no raw card data; fulfill from verified webhooks |

## Component catalogues — harvest only

| Source | Status | Useful for | Rule |
| --- | --- | --- | --- |
| React Bits | Harvest | Creative React effects and interaction studies | Copy only a selected component under valid terms; convert to Hub tokens |
| 21st.dev | Harvest | Searching a broad component registry; possible agent-assisted discovery | Treat any agent/MCP connection as separate setup; inspect source and licence before use |
| Aceternity UI | Harvest / buy candidate | Hero engineering patterns, perspective, tracing and spotlight treatments | Borrow the engineering idea, never its default AI/SaaS aesthetic; no purchase without approval |
| Magic UI | Harvest | Beams, text reveals, navigation structures and restrained motion ingredients | Use free/source-available candidates first; strip redundant motion dependencies |
| Spectrum UI | Lab / harvest | Radix-oriented animated control experiments | Validate accessibility and source ownership before adoption |
| React Bits Pro / Aceternity Pro | Hold purchase | Potential acceleration after a named production need exists | Price, licence and value must be checked at decision time; do not buy speculatively |

Catalogue URLs:

- React Bits: https://www.reactbits.dev/
- 21st.dev: https://21st.dev/
- Aceternity UI: https://ui.aceternity.com/
- Magic UI: https://magicui.design/
- Spectrum UI: https://ui.spectrumhq.in/

## Spatial and capture tools

| Tool | Status | Named experiment | Pass gates |
| --- | --- | --- | --- |
| Spark | Lab | Load a real Lloyds Wharf Gaussian capture inside the existing Three.js/R3F direction | Better than video on fidelity and usefulness; acceptable mobile frame time, transfer size and fallback |
| SuperSplat | Lab pipeline | Clean, crop, optimise and export a captured Gaussian-splat scene | Reproducible export; visible quality gain; acceptable compression |
| Rapier | Lab | Collision volumes, navigation nodes and proximity triggers for a verified spatial scene | Must improve navigation; never required merely to display the floor plan |
| TSL / WebGPU | Lab | Water, light, point and material studies | WebGL2 path remains a release gate; experimental renderer never blocks core content |
| Spline | Hold | Fast spatial sketching and concept comparison | Prototype only unless exported assets pass the production pipeline |
| React Three XR | Hold | Future AR/VR outputs from the same spatial assets | No current product job; do not architect core booking around XR |

Spatial URLs:

- Spark: https://sparkjs.dev/
- SuperSplat: https://playcanvas.com/products/supersplat
- Rapier for JavaScript: https://rapier.rs/docs/user_guides/javascript/getting_started_js
- Three.js WebGPU renderer: https://threejs.org/manual/pages/webgpurenderer
- Theatre.js: https://www.theatrejs.com/

## Interface and animation candidates

| Tool | Status | Potential job | Guard |
| --- | --- | --- | --- |
| Liquefy | Lab | A specific refractive navigation/control material | Interface material only; never the building's identity; no glass over brickwork |
| Rive | Hold | A stateful, purposeful micro-interaction or future concierge embodiment | Do not add for decorative motion already owned by GSAP or Motion |
| Purchased PBR/HDRI/audio assets | Buy candidate | Supporting brick, stone, plants, props, environmental light and restrained ambience | Real Lloyds Wharf first; captured Hub second; purchased support third; generated last |

## Concierge and AI

| Tool | Status | Decision |
| --- | --- | --- |
| HeyGen or another avatar service | Hold | Do not purchase or integrate until a real concierge can query inventory, answer a concrete space request and complete a useful booking/tour flow |
| Text-based concierge | Future lab | First prove operational intelligence against real spaces, availability and policies; an avatar is presentation, not the intelligence |

An unsolicited talking head in the corner is explicitly out of scope.

## Rejected architecture patterns

- Installing several component libraries as overlapping design systems.
- Copying catalogue aesthetics without adapting them to Lloyds Wharf.
- Multiple motion engines controlling the same interaction.
- Curtains.js beside an R3F scene.
- Lenis plus ScrollSmoother.
- Theatre.js Studio in production.
- WebGPU-only essential content.
- A visual renderer acting as the booking database.
- Mock availability in production.
- Purchasing an avatar before the operational concierge exists.

## Required evaluation record

Every Lab or Harvest candidate must add one row to `docs/research/COMPONENT_REGISTRY.md` or a
short decision record containing:

- Source URL and exact version or retrieval date.
- Licence and acquisition status.
- Named Hub job.
- What existing implementation it is compared against.
- Added dependencies and bundle cost.
- Accessibility and reduced-motion result.
- Mobile performance result.
- Fallback behavior.
- Decision: adopt, revise, hold or reject.

