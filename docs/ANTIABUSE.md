# Antiabuso ordini (v1)

Tutti i controlli veri sono nel database, in `supabase/migrations/20261013140000_order_antiabuse.sql`.
L'app mostra solo i messaggi (`lib/utils/antiabuse.ts`).

| Regola | Dove | Default (per pizzeria, in `companies`) |
|---|---|---|
| Niente ordini da ospite o da sessione anonima | `create_order_with_items` + grant revocato ad `anon` | sempre |
| Valore massimo ordine | `assert_order_antiabuse` | `max_order_total = 150` |
| Ordini aperti per utente (pending/accepted/preparing/ready) | `assert_order_antiabuse` | `max_open_orders_per_user = 2` |
| Rate limit | `assert_order_antiabuse` | `order_rate_limit_count = 3` in `order_rate_limit_window = 10 min` |
| Account bloccato (per pizzeria) | `customer_restrictions(company_id, customer_id)`, RPC `set_customer_blocked` | — |
| Mancati ritiri (contati per pizzeria) | `order_no_shows` + `customer_restrictions.no_show_count`, RPC `mark_order_no_show` | blocco a `no_show_block_threshold = 3` |
| Cloudflare Turnstile | edge function `verify-turnstile` + `order_captcha_passes` | `require_turnstile = false` |

I retry idempotenti dello stesso ordine (stesso UUID) passano sempre: i limiti valgono solo per ordini nuovi.

Admin: `mark_order_no_show(order_id, note)` segna "non ritirato"; `set_customer_blocked(customer_id, blocked, reason)` blocca/sblocca.

Blocchi e mancati ritiri valgono **solo per la pizzeria dell'admin**: un cliente bloccato da Ambrosia può ancora ordinare da un'altra pizzeria, e un admin può bloccare solo chi ha già ordinato da lui. `profiles` non viene toccato. Un blocco globale (es. abuso su più pizzerie) resta fuori da v1: andrebbe fatto da service role.

## Cosa deve configurare Carmine (nessun segreto nel repo)

1. Unire prima il login solo Google (PR #17) e attivare Google su Supabase: da questa migration gli ospiti non possono più ordinare.
2. Applicare la migration (dopo #11) con `supabase db push` o dallo SQL editor.
3. Turnstile (facoltativo):
   - Cloudflare → Turnstile → nuovo widget per il dominio di prod (e `localhost` per i test).
   - Vercel: `EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key>` (pubblica).
   - Supabase: `supabase secrets set TURNSTILE_SECRET_KEY=<secret key>` e `supabase functions deploy verify-turnstile`.
   - Poi `update companies set require_turnstile = true where id = '<company>'`.
   Se si accende `require_turnstile` senza la site key nel client, nessuno riesce a ordinare.
4. Limiti diversi: `update companies set max_order_total = 200 where id = '<company>'` (idem per gli altri campi).

## Test

- SQL (PGlite, nessun DB ospitato): `npm i --no-save @electric-sql/pglite && node tests/sql/run-antiabuse-pglite.mjs`. Se nel checkout c'è anche #18 applica le sue migration e il suo test (combo #11+#18+#20).
- Merge con #18: in `tests/sql/atomic-order-submission.sql` tenere la versione di #20 (funziona con e senza #18).
- Unit: `npx vitest run tests/unit`
