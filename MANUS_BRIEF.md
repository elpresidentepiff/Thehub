# Brief: build the website for The Hub at Lloyds Wharf

You are asked to design and build the public website for The Hub at Lloyds Wharf, a workspace in a
Victorian wharf warehouse in Shad Thames, London.

Take the information in this repository. **Make the design your own.** You are not asked to continue,
restyle or copy `proto/opening.html`. It is a prototype by someone else and is described below only so
you can learn from it. A fresh idea that respects the rules in this file beats a polished copy of it.

Read these first, in this order:

1. This file.
2. `.claude/skills/hub-experience/SKILL.md`: the project constitution. Where it conflicts with a
   generic best practice, it wins.
3. `tokens/tokens.css` and `tokens/tokens.json`: colours measured from the real building.
4. `pricing/pricing.json` and `docs/PRICING.md`: the prices.

`docs/BUILD_PLAN.md` and `docs/LAUNCH.md` are background. Everything under `docs/` marked "proposal"
and everything in `lab/` is research; none of it is an instruction to build.

## What the place is

State these as fact. Do not add to them.

- **Name:** The Hub at Lloyds Wharf. The lockup is `THE HUB @ LLOYDS WHARF`.
- **Address:** 2 Mill Street, Shad Thames, London SE1 2BD.
- **Building:** a Victorian wharf warehouse, **established 1857**. Use 1857, never 1859.
- **Three things that are physically there**, and that carry the brand:
  1. `EST. 1857` is cast into the entrance wall.
  2. The mark is a **mooring cleat**, the fitting you tie a boat to. Not an anchor, not a box. It
     means hold fast, this is where you land. The line that falls out of it: **things dock here**.
  3. The **River Neckinger** runs underneath the building and enters the Thames at St Saviour's Dock.
     There is a hand-painted sign about it on the wall. Water on this site means the Neckinger, never
     decoration.
- **The floor:** grey-oak herringbone, brick, dark timber beams, cast-iron columns, black Crittall
  glazing, arched windows, white desks, yellow lockers.

## Directive

### You must

- Make it unmistakably this building. If a design decision would be identical on any other coworking
  site, it is the wrong decision.
- Use the measured colours in `tokens/` and no others. Type is **Archivo Black** for display and
  **Archivo** for everything else, from Google Fonts, with a real fallback stack. Small labels are
  Archivo 600, uppercase, wide letter-spacing.
- Write copy from the visitor's side of the screen. Plain, specific, short. A button says exactly what
  it does. The building is 169 years old and does not need adjectives.
- Read prices from `pricing/pricing.json`. Never type a price into markup or script, and never put one
  in a meta description. All prices are monthly or per day, in GBP, and **include VAT**.
- Make every motion earn its place: it must communicate place, hierarchy or story. Anything that
  animates in starts from a visible resting state, never from `opacity: 0` waiting for an observer.
- Give `prefers-reduced-motion` a designed static alternative, not a disabled page.
- Make it work with no WebGL at all. Any 3D or video effect needs an image or video equivalent.
- Design for a phone first (test at 390 px wide) and make it correct at tablet and desktop.
- Meet accessibility basics: semantic HTML, one `h1`, a `lang`, keyboard operation with visible focus,
  text contrast of at least 4.5:1, meaningful alt text, no sideways scroll.
- Keep first load light. Aim for the page to be usable in under 2 MB before any footage streams.
- Use real Lloyds Wharf material first (see Inputs). Purchased support assets third. Generated last.

### You must never

- Never produce a generic SaaS, property or coworking template. No "vibrant community of
  innovators", no "where ideas come to life", no stock-photo people.
- Never use generated imagery or video to invent the building or its rooms.
- Never invent facts. Not opening hours, not tours, not capacity, not other floors, not tenants, not
  awards, not testimonials, not a phone number or email address.
- Never show fake availability, fake bookings or fake "only 2 left" urgency.
- Never take payment, create Stripe or Supabase objects, or add analytics, tracking or cookies. None of
  that has been approved.
- Never use Inter or Space Grotesk, purple-to-blue gradients, neon, or frosted glass over brickwork.
- Never make the floor plan's CAD paths clickable. The plan is scenery.
- Never commit keys, tokens or personal data to this repository. It is public.

## What is free for you to decide

Layout, page structure, the opening, the interaction model, the motion idea, the order of sections, the
exact copy (within the voice rules), and the technology. A static site is fine. A framework is fine.
The constitution names Next.js, React and GSAP as the eventual production stack; use them if they serve
the design, but you are not required to. Pick one approach, keep dependencies few, and say why.

The operator is interested in a site that feels **touched and alive**, not a film you scroll past.
Ideas welcome, within these honest limits:

- Haptics are a progressive enhancement only. `navigator.vibrate` works on Android Chrome. iPhone
  Safari has no vibration API; a hidden `<input type="checkbox" switch>` trick has worked on some iOS
  versions but is unreliable, so never depend on it. Every haptic moment needs a visual equivalent and
  an off switch, and must not fire under reduced motion.
- A Gaussian-splat view of the real floor is a future experiment. **No trained splat exists yet.**
  Do not fake one. If you design for it, leave a clean slot and a video or image fallback.

## Inputs

| Path | What it is |
| --- | --- |
| `assets/brand/lloyds-wharf-cleat-wall.jpg` | Real photograph: the painted cleat, "LLOYDS WHARF", "ESTD 1857" on brick, timber bench, cobbles |
| `assets/brand/nekinger.jpg` | Real photograph: the hand-painted River Neckinger / St Saviours Dock sign |
| `assets/brand/hub-sign-lit.jpg` | A **render** of a proposed backlit reception sign, not a photograph. The operator's signage specification (version 1.0, September 2026) labels the same picture "example render". The sign may not exist yet. Never present it as a photograph or as the real entrance. It may inform the sign's look, no more |
| `assets/brand/cleat.svg` | The cleat mark as vector paths, `viewBox 0 0 1000 340` |
| `assets/photos/floor-corridor-1.jpg`, `floor-corridor-2.jpg` | Two real portrait photographs of the floor (glass partitions, columns, lockers) |
| `assets/video/arrive.mp4`, `arrive_poster.jpg` | 11 s walk in from the entrance corridor. 720x1280 portrait |
| `assets/walk/w_001.webp` to `w_113.webp` | The whole 56 s walkthrough as 113 frames, in order, 540x960 portrait. `walk.json` describes them. Landmarks: entrance corridor 1-6, glass partitions 7-18, brick wall and desks 19-24, timber posts 25-29, arched windows 33-37, yellow lockers 38-40, long white desks 67-84, black wall 85-96, sofa and clock 97-110, the window onto Shad Thames 111-113 |
| `assets/plan/floor_unit4_l2.svg` | Measured floor plan, Unit 4, second floor. `viewBox` is in metres. See the constitution before using it |
| `tokens/` | Measured colour and type tokens |
| `pricing/pricing.json` | Plans, day pass, VAT-inclusive pence |

The footage is **portrait** (720x1280) and handheld. A landscape reshoot is planned but has not
happened. On a wide screen, frame the portrait footage deliberately (for example as a column). Do not
stretch it full-bleed, which crops it to a strip of floor.

## Other branches (reference only)

This branch, `main`, is the brief and the shared assets. The operator's earlier build lives on the
**`develop`** branch and is worth reading for ideas, not for copying:
https://github.com/elpresidentepiff/Thehub/tree/develop

- `lab/history-studies/neckinger.html`: a three.js tunnel down the River Neckinger, with credited
  public-domain archive pictures set into the brick, that comes up into the real corridor footage.
  Run `npm install` first, because `three` is loaded from `node_modules`. Image sources and licences are in
  `lab/history-studies/archive/CREDITS.md`. Some are CC BY-SA, so credit lines must travel with any use.
- `lab/cleat-studies/`: studies of the cleat.
- `src/`, `package.json`: a Next.js application with a contact page, a booking floor and Supabase wiring
  that is switched off. It is an earlier attempt, not a requirement. Supabase and Stripe stay off.

## Facts nobody has supplied yet

Show these as nothing, or as a clearly marked configurable placeholder that renders nothing when empty.
Do not guess them.

- **Email and phone.** The contact route for now is email and phone. Online booking and payment are
  not open yet and will be connected later, so leave a clean place for a real join action to replace the
  contact links. Put the two values in one configuration object.
- The wording of the five-word line. Three variants appear in the supplied material: `WORK MEET CREATE
  COLLABORATE BELONG`, `WORK CONNECT BELONG` (on the proposed sign) and the lockup
  `WORK · MEET · CREATE · CONNECT · BELONG`. The real photograph of the cleat wall carries no
  such line, so none of the three is confirmed as built. Use the lockup as a placeholder and make it
  one edit to change. The operator decides.
- Opening hours, tour booking, VAT registration status, final plan names, the accent yellow (RAL), the
  other floors, and the tenants.
- A link-preview image and the final domain.

## Pricing, so you get it right

Three monthly memberships and a day pass, all including VAT, no contract. Hours reset each billing
month and do not roll over. Online booking is not open yet. Show an hourly rate only if you compute it
from the JSON. If you add anything like a "which plan fits" helper, it too reads the JSON.

## What the prototype taught us

`proto/opening.html` is one static page. It is evidence of what went wrong, not a template.

- The first screen showed only "EST. 1857". A visitor never saw the place's name. Show the name.
- Full-bleed portrait footage on desktop is a strip of floor and soft. Frame it.
- Looping the 11 s walk jump-cut from the desks back to the door. Play it once and hold.
- Small low-contrast text over footage was unreadable. Test contrast over the real frames.
- A missing `viewport` meta made phones render at 980 px. A missing charset turned "£" into "Â£".
- Tiny labels collided on a 390 px screen. Test on a real phone-sized viewport.
- Prices must have one source. The prototype generates `pricing/pricing.js` from the JSON for pages
  opened from disk; a built site should just import the JSON.

`tools/check_site.py` tests that prototype's own element ids, so it will not run against a new design.
Treat its list of checks as the standard to meet: standards mode, UTF-8, lang, viewport, one `h1`,
prices equal the JSON, no sideways scroll at 390 / 768 / 1280, contrast, keyboard reach, reduced motion
working, no console errors.

## Deliverable

- Put the source in a `site/` folder on a branch named `manus-site`. Do not modify `pricing/`,
  `tokens/`, `assets/` originals, `.claude/` or `proto/`. Add new files beside them.
- Include `site/README.md`: how to build and run it, what you chose and why, and anything you could not
  do or decided against.
- Give a preview URL. Do not point a custom domain at it.
- List every external script, font and service the site loads, and every place a price is read.
- If a rule in this file blocks something you think would be better, say so in the README and keep the
  rule. The operator decides.
