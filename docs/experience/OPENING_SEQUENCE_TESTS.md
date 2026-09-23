# Opening sequence tests

Status: **not approved**. The first visual pass was reviewed on 23 September 2026 and did
not reach the required quality. Preserve it only as evidence of approaches tried; do not
continue or promote one of these variants without a new creative brief.

The approved narrative is intentionally short:

```text
EST. 1857
→ gold line
→ living mooring cleat
→ the real Hub
```

The intermediate HUB photograph/letter-mask scene has been removed.

## Test A — Liquid cleat → direct video

The reliable baseline. The cleat breathes, distorts and pushes toward the viewer while the real walkthrough crossfades in.

Use if it wins on restraint, clarity and performance. This is also the intended low-power and reduced-motion fallback.

## Test B — Liquid cleat → gold particles → video

The cleat releases warm particles that travel toward and around the viewer, exposing the walkthrough behind them.

The particles must feel like illuminated water, brass and material fragments—not digital confetti.

## Test C — Cleat → spatial point reconstruction → video

A pre-capture study of the proposed Gaussian-splat transition. Points leave the cleat and assemble into a sampled representation of the real interior before resolving into the walkthrough.

This is **not** a real Gaussian splat. It is a visual test of the transition grammar using the current poster image. A genuine version requires a fresh multi-angle capture, splat reconstruction, cleanup/optimisation and a runtime evaluation.

## Review criteria

Score each test from 1–5:

1. Does the cleat remain recognisable and feel physically alive?
2. Does the transition feel specific to Lloyds Wharf rather than like a technology demo?
3. Is the arrival into the real building clear and emotionally satisfying?
4. Does it remain smooth on a representative phone?
5. Does it respect reduced-motion preferences?
6. Does the effect earn its loading and implementation cost?

## Technical boundary

No new production dependency has been added for these studies. The comparison is deliberately built with SVG, Canvas 2D and the existing video so the creative decision can be made before introducing Three.js, Spark or a Gaussian-splat asset.
