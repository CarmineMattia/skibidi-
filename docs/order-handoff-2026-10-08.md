# Recipe photos and reliable order handoff

48 generated illustrative photos are bundled with the app and available on `/pizza-foto`, without database access. Product images match the deterministic seeded product id and the exact description; a changed recipe falls back to its configured product image. Recipes and generation prompts are in `assets/images/products/pizza-photo-manifest.json` and `pizza-photo-prompts.json`. Stria and five configurable al-metro products have no fixed recipe and remain without generated photos.

## Backend deployment prerequisite

The configured project `zqubwvhstobaugifzoyb.supabase.co` returned DNS NXDOMAIN on 2026-10-08, including public DNS. The production app still references this project. Its actual account status cannot be determined without signing in. Restore/access it in Supabase before attempting a real order.

Apply `supabase/migrations/20261008_atomic_order_submission.sql` before releasing the order-submission changes. It requires the existing `get_order_tracking`, display-code and guest-order RLS migrations already used by this app. The new transaction remains subject to existing RLS, including its product-price rules. Validate a real customized multi-item cart against the restored database as well as a normal guest cart; the local database tests do not verify the hosted schema or staff profiles.

Until this migration exists, the new checkout fails explicitly and keeps the cart instead of claiming an order succeeded. No production database migration or real order has been executed by this work.

Orders and lines now commit together. A stable UUID prevents duplicating a successfully saved order when its response is lost. Repeated UUIDs with different contents are rejected. Empty orders cannot be accepted. The offline queue performs a real submission and preserves failures; queued orders stay scoped to their restaurant. Kitchen status writes require an actual returned row. Tracking polls every five seconds for guests, distinguishes pending from accepted, and shows verification errors instead of inventing a status. The ready delivery state means ready for delivery, not that a courier has departed.

## Validation

- TypeScript check and Expo web export.
- 81 unit tests, including offline reconnect/failure preservation and zero-row kitchen updates.
- Eight Chromium browser tests: menu/cart, guest pending → accepted → ready without Realtime, unavailable backend, truthful success screen, 48 loaded gallery images and a recipe-matched menu photo.
- Disposable PostgreSQL 17 validation using the actual tracking and guest RLS migrations: anonymous atomic insert, rollback on line failure, idempotent retry, invalid input and non-readable direct guest order rows. A trigger rejects accepting empty orders.

To reproduce SQL validation, use a disposable PostgreSQL database only: run `tests/sql/atomic-order-schema.sql`; then the tracking-function section of `20260610_tighten_orders_rls_tracking_rpc.sql`, `20260901_fix_guest_order_items_rls.sql`, and `20261008_atomic_order_submission.sql`; finally run `tests/sql/atomic-order-submission.sql`. The fixture creates its own small schema and roles and must never run on a hosted restaurant database.

After access is restored, verify guest creation, kitchen visibility of all lines, staff acceptance, customer polling, ready state and decline reason in separate browser sessions. Complete the production release through the repository’s PR workflow.
