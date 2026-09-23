# Hub laboratories

Everything under `/lab` is isolated research. A lab does not become production because it
looks impressive or because its library is listed in `docs/research/TECHNOLOGY_RADAR.md`.

## Existing

- `/lab/opening-tests/` — rejected first-pass comparison of direct, particle and simulated
  spatial transitions. Retained as visual research; not approved production direction.

## Available mock product labs

- `/lab/floor/` — measured plan with stable mock bookable-unit overlays, filters, status
  treatments, touch/keyboard selection and a spatial detail card.
- `/lab/booking/` — mock date/time, duration and extras flow carried from the stable unit ID.
- `/lab/checkout/` — non-paying boundary study showing the intended server hold → Stripe →
  webhook → booking sequence. It contains no credentials or payment action.

All availability, positions and prices in these labs are clearly labelled development data.
They use local storage only to carry a mock selection between routes.

## Planned spatial labs

- `/lab/splat/` — one real Lloyds Wharf Gaussian capture loaded with Spark.
- `/lab/spatial/` — measured plan plus R3F and, only if useful, Rapier navigation/hotspots.
- `/lab/webgpu/` — TSL/WebGPU effects with an explicit WebGL2 comparison.

## Promotion gate

A lab may be proposed for production only after it records:

- Named user or business value.
- Source/version/licence.
- Visual comparison with the current production-safe approach.
- Representative mobile performance and transfer size.
- Keyboard and reduced-motion behavior.
- No-WebGL or static fallback where relevant.
- Security/data boundary where relevant.
- Adopt, revise, hold or reject decision.

Do not share production credentials with a lab. Do not allow mock availability or test
Stripe products to appear as real inventory.
