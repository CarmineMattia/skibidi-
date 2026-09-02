# Production goal — Skibidi Orders (Prime Agent)

## Mission

Bring **Skibidi Orders** (this repo) to a **production-ready restaurant ordering app**:

1. **No critical bugs** — customer, kitchen, and admin flows work end-to-end.
2. **Fluid UX** — fewest clicks possible from open app → paid order.
3. **Payments ready** — wire real payment plumbing (Stripe first; Satispay hooks if present), replace mocks, keep secrets out of the client.
4. **Ship checklist** — type-check, lint, unit tests, Playwright smoke for the order path.

## Non-goals (do not expand scope)

- Full offline-first rewrite
- New marketing features / banners / social proof
- Redesigning the brand from scratch
- Committing secrets or real API keys

## Priority order

### P0 — Must work (blocking production)

1. Customer path: **menu → add to cart → checkout → pay → order success** with minimal steps.
2. Kitchen path: new paid order appears; status updates (preparing → ready → done).
3. Admin path: manage menu/products; see orders; configure checkout settings that actually apply.
4. Fix critical **RLS / security** issues (public write on products/orders/categories/order_items) — see `QUALITY_GATE_REPORT.md`.
5. Payments: replace mock Stripe in `lib/hooks/usePayment.ts` with a real intent flow (Edge Function or server), feature flag via `EXPO_PUBLIC_PAYMENT_GATEWAY_ENABLED`, never put secret keys in Expo public env.

### P1 — Fluid UX (fewer clicks)

1. Collapse redundant screens/modals on the customer checkout path.
2. Guest ordering without forced signup where possible.
3. Persist cart sensibly; clear recovery on errors (no dead ends).
4. Fast feedback: loading / success / failure states on every payment & order action.
5. Mobile + web both usable for the core order path.

### P2 — Payments production prep

1. Stripe Checkout or Payment Intents + webhook to mark order paid.
2. Map payment method correctly into fiscal receipt fields.
3. Env template updates in `.env.example` (public keys only on client).
4. Admin setting to enable/disable payment gateway + provider.
5. Satispay stub/interface only if Stripe path is solid.

### P3 — Hardening

1. `npm run type-check` clean
2. Relevant Playwright e2e green for order + kitchen smoke
3. Remove debug leftovers before considering “done”
4. Document how to turn on live payments in `SETUP-GUIDE.md`

## Definition of done

A restaurant can:

- Publish a menu
- Take a customer order with **≤ clicks** (target: menu browse → cart → one checkout screen → pay → done)
- Receive the order in kitchen reliably
- Accept **card payment** in test mode (Stripe test keys) with a clear path to live keys
- Not expose open write RLS to anonymous users

## Working rules for the agent

- Work only in this repo. Prefer small, verified commits in the project’s commit format if committing.
- Run `npm run type-check` after meaningful changes.
- Prefer fixing existing flows over adding new screens.
- Do not invent fake “production ready” claims — leave a short STATUS.md with what works / what’s left.
- If blocked on secrets (Supabase/Stripe keys), prepare code + docs and stop cleanly.

## First actions

1. Map current customer checkout + payment code paths.
2. List bugs / dead ends / extra clicks.
3. Fix P0 security + order flow bugs.
4. Implement Stripe test-mode payment path.
5. UX pass for click reduction.
6. Write `STATUS.md` with remaining ops steps (keys, deploy, webhooks).
