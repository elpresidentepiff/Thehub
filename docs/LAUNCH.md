# Launch

Target about 2026-11-04. Nothing here is committed or hosted yet.

## Check before any release

    python3 tools/check_site.py                       # the prototype
    python3 tools/build_dist.py                       # flat dist/ for a host
    python3 tools/check_site.py --page dist/index.html --launch

`--launch` adds the go-live blockers. It fails on purpose until the two items below are done.

## Blockers

1. **Contact route.** Email and phone are the interim route until booking and payment go live.
   Set them in one place: `window.HUB_CONTACT` near the top of the scripts in `proto/opening.html`.
   An empty field shows nothing. Each plan then gets an "Ask about this plan" link.
   When checkout exists, replace these links with the real join action.
2. **Prototype corner note.** Remove the `#note` element ("Opening sequence prototype ...") once the
   opening sequence is approved. `docs/OPENING_SEQUENCE_TESTS.md` still records the first visual pass as not approved.

## Open decisions (operator)

- Hosting and domain. Publishing and spend need an explicit yes.
- Privacy notice, if enquiries ever collect details. Email and phone links collect nothing.
- VAT registration status; whether Unlimited at the stated price is right for one site; coffee discount; plan names.
- The five-word line has three variants (constitution says ask before setting production copy). The page uses
  WORK / MEET / CREATE / CONNECT / BELONG.
- Accent yellow RAL. Link-preview image (needs the final domain for an absolute URL).

## Done in this pass

- Footage framed as a column on landscape screens (it is 720x1280 portrait), full-bleed on phones.
- Walk plays once and holds on the floor; no jump-cut back to the corridor.
- Name `THE HUB @ LLOYDS WHARF` shown with the five words (it was only in a hidden heading before).
- Page description, icon, theme colour. No prices typed outside `pricing/pricing.json`.
