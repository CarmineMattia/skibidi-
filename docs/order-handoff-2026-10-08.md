# Recipe photos and reliable order handoff

48 generated illustrative photos are bundled with the app and available on `/pizza-foto`, without database access. Product images match the deterministic seeded product id and the exact description; a changed recipe falls back to its configured product image. Recipes and generation prompts are in `assets/images/products/pizza-photo-manifest.json` and `pizza-photo-prompts.json`. Stria and five configurable al-metro products have no fixed recipe and remain without generated photos.

## Backend deployment prerequisite

The configured project `zqubwvhstobaugifzoyb.supabase.co` initially returned DNS NXDOMAIN on 2026-10-08, including public DNS. Later that day it became reachable again: the public API returned the active Ambrosia company and an active product. Calling `create_order_with_items` with an empty, non-order payload returned `PGRST202`: the required function is not installed in the hosted schema cache. No restaurant order was created by this probe. Dashboard access is still needed to apply the migration before attempting a real order.

Apply `supabase/migrations/20261008_atomic_order_submission.sql` before releasing the order-submission changes. It requires the existing `get_order_tracking`, display-code and guest-order RLS migrations already used by this app. The new transaction remains subject to existing RLS, including its product-price rules. Validate a real customized multi-item cart against the restored database as well as a normal guest cart; the local database tests do not verify the hosted schema or staff profiles.

Until this migration exists, the new checkout fails explicitly and keeps the cart instead of claiming an order succeeded. No production database migration or real order has been executed by this work.

Orders and lines now commit together. A stable UUID prevents duplicating a successfully saved order when its response is lost. Repeated UUIDs with different contents are rejected. Empty orders cannot be accepted. The offline queue performs a real submission and preserves failures; queued orders stay scoped to their restaurant. Kitchen status writes require an actual returned row. Tracking polls every five seconds for guests, distinguishes pending from accepted, and shows verification errors instead of inventing a status. The ready delivery state means ready for delivery, not that a courier has departed.

## Validation

- TypeScript check and Expo web export. The existing lint command could not run because ESLint is not installed in this project.
- 86 unit tests, including offline reconnect/failure preservation, zero-row kitchen updates, missing/mismatched server acknowledgements, and reuse of the same submission ID after a lost response and reload.
- Eight Chromium browser tests: menu/cart, guest pending → accepted → ready without Realtime, unavailable backend, truthful success screen, 48 loaded gallery images and a recipe-matched menu photo.
- Disposable PostgreSQL 17 validation using the actual tracking and guest RLS migrations: anonymous atomic insert, rollback on line failure, idempotent retry, invalid input and non-readable direct guest order rows. Separate guest and authenticated staff roles verify kitchen access to saved lines, staff acceptance, guest tracking of that acceptance, and isolation from another restaurant. Staff identity/update access is modeled in the local fixture; hosted profiles and staff write policies remain unverified. A trigger rejects accepting empty orders.

To reproduce SQL validation with Podman, run `bash tests/sql/run-order-handoff.sh`. It creates and removes a disposable PostgreSQL container, applies the fixture and actual migrations, and runs the handoff checks. The fixture creates its own small schema and roles and must never run on a hosted restaurant database.

After access is restored, verify guest creation, kitchen visibility of all lines, staff acceptance, customer polling, ready state and decline reason in separate browser sessions. Complete the production release through the repository’s PR workflow.
