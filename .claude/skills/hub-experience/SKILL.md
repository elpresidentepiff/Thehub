---
name: hub-experience
description: The design and engineering constitution for The Hub at Lloyds Wharf. Load before writing ANY code, copy, colour, type or motion for this project — pages, components, shaders, 3D scenes, CMS content or marketing copy. Carries the measured brand values, the material language, the motion rules, the stack boundaries and the prohibitions.
---

# The Hub at Lloyds Wharf — project constitution

2 Mill Street, SE1 2BD. A Victorian wharf warehouse in Shad Thames, established 1857,
now a workspace. This file governs every design and engineering decision on the project.

**Read this before writing anything. Where it conflicts with a generic best practice, this wins.**

## The one prohibition

> Never turn The Hub at Lloyds Wharf into a generic SaaS, property or coworking template.

If a decision would be identical on any other coworking site, it is the wrong decision.

## What the building actually is

Three facts carry the brand. All three are physically present in the building — none are invented.

1. **EST. 1857.** Cast into the entrance wall and into the logo. Use 1857, never 1859.
   The Lloyd & Sons occupancy began 1859; the building's own claim is 1857 and it is the
   one a visitor can walk up and touch.
2. **The mark is a mooring cleat** — a wharf fitting you tie a boat to. Not a tin box,
   not an anchor. It means *hold fast, this is where you land*. The brand line that falls
   out of it: **things dock here**.
3. **The River Neckinger runs underneath.** A subterranean river that rises in Southwark
   and enters the Thames at St Saviour's Dock. There is a hand-painted sign about it on
   the wall. Water motifs are never decorative on this project — they are the Neckinger.
   A river that still flows where you cannot see it is the whole idea of the place.

## Two light states

The building photographs in two distinct registers. Every scene must sit in one of them,
and moving between them is how the project expresses past → present.

**Arrival (warm).** The entrance, the lit sign, heritage, night. Amber halo on blackened
steel against warm brick, everything else falling to black.

| Token | Hex | Role |
| --- | --- | --- |
| `--ink` | `#0B0907` | ground, deepest shadow |
| `--halo` | `#FEE6B5` | the backlight core — the signature light |
| `--halo-warm` | `#F8CF95` | halo falloff |
| `--brass` | `#B97C3C` | mid amber, rules and accents |
| `--brick-lit` | `#B48963` | brick in the light |
| `--brick` | `#79573B` | brick, mid |

**Floor (cool).** The working space, daylight, present day. Grey-oak herringbone, white
desks, blue window light.

| Token | Hex | Role |
| --- | --- | --- |
| `--oak` | `#A48F7C` | herringbone floor |
| `--oak-lit` | `#C8B7A8` | floor in sun |
| `--timber` | `#664F32` | beams, deep brick |
| `--steel` | `#342D2F` | cast-iron columns, Crittall frames |
| `--panel` | `#0F0E12` | black acoustic wall |
| `--daylight` | `#7E8EB1` | light through the arched windows |
| `--plaster` | `#E0DDDC` | white desks, plaster |
| `--cream` | `#EFE7DA` | type on dark |

All values measured from the real photography, not chosen. Do not invent new brand colours.

**Accent yellow is UNRESOLVED.** The pedestals measure `#786000`–`#846C00` in the footage,
which is interior underexposure rather than the paint. Approximately `#E3B400` normalised.
Do not lock it in code until the operator supplies a RAL or a daylight photograph.

## Materials

Brick, blackened steel, timber, glass, water, warm light, greenery. Every surface in the
product should be traceable to one of them. No frosted-glass-on-gradient, no neon, no
purple-to-blue, no glassmorphism for its own sake.

## Type

The building's own signage is heavy grotesque caps. Match it.

- Display: `Archivo Black` — THE HUB, headlines
- Body and UI: `Archivo` 400/500/600/700
- Small labels: `Archivo` 600, uppercase, `letter-spacing: .3em`, with matching `text-indent`
  so the trailing space does not break centring

Load from Google Fonts (the only font host the CSP admits) with a real fallback stack.
Never Inter, never Space Grotesk.

## Brand language

```
THE HUB @ LLOYDS WHARF
WORK · MEET · CREATE · CONNECT · BELONG
```

The five words are information architecture, not decoration — they are the top-level
sections of the site.

**Unresolved:** the entrance wall reads `WORK MEET CREATE COLLABORATE BELONG` and the
sign under the cleat reads `WORK CONNECT BELONG`. Three variants exist. Ask the operator
before setting any of them in production copy.

## Motion

Architectural and deliberate. Motion communicates **place, hierarchy or story** — if it
communicates none of those, remove it.

- No animation for its own sake. A section that animates in must animate from a *visible*
  resting state, never from `opacity: 0` awaiting an observer.
- Orchestrated moments beat scattered effects. One choreographed sequence, then stillness.
- `prefers-reduced-motion` gets a real static alternative, not a disabled page.
- Easing: slow out, settled. Nothing bouncy, nothing elastic. This is a Victorian
  warehouse, not a toy.

## Spatial

Build a small number of hero spatial moments. Do not model the building.

Justified today: the entrance transition, the arrival on the floor, the 1857→today
transformation, and the birds-eye floor for seat selection. Everything else uses
photography and video with depth treatment.

Mobile gets adaptive quality. Weak hardware gets a cinematic video or image fallback.
**The site must be completely usable with no WebGL at all.**

## Liquid glass

An interface material, not the identity. Permitted on navigation, floating controls, room
information, booking widgets, filters and the occasional CTA.

Never over brickwork. Twenty blurry rectangles on a Victorian wall is the failure mode.

## The plan and the floor

`assets/plan/floor_unit4_l2.svg` — Unit 4, Second Floor, extracted from the architect's
Rev B drawing.

- **viewBox is in METRES.** Origin top-left, y increasing downward.
- Scale of the source drawing: 1:50 on A1, **56.69 pt per metre**.
- Floorplate: **31.71 m × 18.02 m**.
- Three layers: `#structure` (51 segments), `#partition` (354), `#detail` (6,256).
- **Ship structure + partition as live SVG. Bake `detail` to a raster underlay.**
  All 6,661 as live DOM will not survive mobile.

Seat coordinates, camera paths and wall extrusion all use these same metric coordinates.
One coordinate system across 2D, 3D and video. Never introduce a second.

**Never make CAD paths clickable.** The plan is scenery; seats are rows in a table,
rendered as a separate overlay. A drawing revision must never break a seat.

## Stack boundaries

In: Next.js, React, TypeScript, Tailwind, shadcn/ui + Radix, GSAP + ScrollTrigger, Lenis,
Three.js + React Three Fiber + Drei, Supabase, Stripe.

Rules that are not negotiable:

- **One tweening engine per job.** GSAP owns scroll and story. Motion owns UI physics.
  Anime.js is not installed.
- **One scroll smoothing layer.** Lenis. Never Lenis plus ScrollSmoother.
- **No Curtains.js.** R3F is already running; a video texture on a plane does the same
  work inside the same scene graph. A second WebGL context cannot composite with the first,
  and the whole concept requires the footage and the building to share a shot.
- **Theatre.js studio is dev-only.** Author with it, export state JSON, ship `@theatre/core`
  plus the JSON. Never import the studio in a production bundle.
- **WebGL2 is a release gate.** TSL materials port to both, but the WebGPU postprocessing
  pipeline does not. Bloom, DOF and grain need a WebGL path or the page renders black.
- Nothing enters the bundle without a named job in a named phase. If two libraries can do
  the job, the one already in the bundle wins.

## Media

Real Lloyds Wharf material always beats generated material. Do not let a model invent the
building when the actual building is more interesting.

Current footage is **720×1280 portrait, handheld, 56s** — good footage, wrong aspect for a
full-bleed desktop hero. A landscape reshoot is planned. Until it lands, either frame the
portrait clip deliberately inside the scene or work from the 113 extracted stills.

## Accessibility

Semantic HTML, full keyboard operation with visible focus, real contrast ratios, and a
reduced-motion path that is a designed experience rather than a stripped one. Every WebGL
experience has an image or video equivalent.

## Components

Reuse validated components before inventing another system. shadcn/ui and Radix are the
base. Do not hand-roll a dialog, a popover or a combobox.

## Copy

Write from the visitor's side of the screen. Specific beats clever. A control says exactly
what happens. No property-marketing register — no "vibrant community of innovators",
no "where ideas come to life". The building is 169 years old and does not need adjectives.
