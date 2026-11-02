# Pricing scheme

Set by the operator on 2026-11-01. This is the Hub's own scheme. Wording and plan names here are ours.

Machine-readable copy: [`pricing/pricing.json`](../pricing/pricing.json), the single source. Amounts
there are gross pence, so £180 is `18000`. No price is typed anywhere else, in markup or in script.

Where it shows: the **Membership** section at the bottom of `proto/opening.html`, below the opening
sequence. That page cannot `fetch` a JSON file when opened from disk, so it loads
`pricing/pricing.js`, which is generated from the JSON. After changing a price, run
`python3 tools/build_pricing_js.py`; `--check` fails if the two have drifted. A different front end
should read `pricing.json` directly.

## Memberships

All prices are monthly, **include VAT**, and carry no contract.

| Plan (working name) | Price | Hours / month | Effective rate | Guests / month | Desk booking window |
| --- | --- | --- | --- | --- | --- |
| 40 hours | £180 | 40 | £4.50 / hour | 1 | 7 days ahead |
| 80 hours | £245 | 80 | £3.06 / hour | 2 | 7 days ahead |
| Unlimited | £295 | no cap | n/a | 2 | 7 days ahead |

## Day pass

| Product | Price | Notes |
| --- | --- | --- |
| Day pass | £40 | One day, one desk. No membership needed. |

## Rules

- Hours reset at the start of each billing month, counted from the day the member joined. They do
  not roll over.
- Cancel any time. A member can pause for a month or more, with no freeze fee and no rejoining fee.
- Moving between plans works at any time. Upgrades apply immediately; downgrades apply from the
  next billing cycle.
- Displayed prices already include VAT. The number shown is the number paid.

## How this fits the commerce rules

- Prices live in Supabase and Stripe, selected server-side. They are not to be written into
  frontend code. See [`COMMERCE_SPATIAL_WORKSTREAM.md`](./COMMERCE_SPATIAL_WORKSTREAM.md) and
  [`STRIPE_OBJECT_MAPPING.md`](./STRIPE_OBJECT_MAPPING.md).
- Membership plans map to Product + recurring Price with `tax_behavior: inclusive`. The day pass
  maps to Product + one-time Price.
- This answers approval question 3 in the Stripe mapping: **VAT is included in displayed pricing.**
- Nothing has been created in Stripe or Supabase. Test-mode products still need the `DEV — Hub`
  prefix, and the production catalogue waits for the remaining approvals listed there.

## Open questions for the operator

Prices are settled. These are not in `pricing.json` until decided.

1. **Unlimited.** The Hub is one site, so the only difference between Unlimited and the 80 hour
   plan is the hours cap. Is £295 still right for that difference?
2. **Coffee discount.** An earlier draft of the scheme included a discount at a bar. Does the Hub
   have a bar or café counter? If not, leave it out.
3. **Plan names.** `pricing.json` uses hours-based working names. Pick the Hub's own names before
   anything customer-facing.
4. **VAT registration.** Prices are quoted gross. Confirm the Hub's VAT status, because it decides
   the net figure (for example £180 gross is £150 net at 20%).
5. **Existing mock prices.** `BUILD_PLAN.md` and the lab inventory carry earlier placeholders for
   dedicated desks (£395 / month) and meeting rooms (£38 and £55 / hour). They are outside this
   scheme and unchanged.
