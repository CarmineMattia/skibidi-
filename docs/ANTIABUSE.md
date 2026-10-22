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
3. Turnstile (facoltativo): vedi la sezione "Turnstile" qui sotto.
4. Limiti diversi: `update companies set max_order_total = 200 where id = '<company>'` (idem per gli altri campi).

## Turnstile

Come funziona:
1. Sul web il checkout (`/modal` e `/one-screen-checkout`) mostra il widget solo se c'è `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (azione `checkout`).
2. Prima di `create_order_with_items` il client manda il token all'edge function `verify-turnstile`. La funzione lo verifica con Cloudflare siteverify (secret dall'env, hostname e azione controllati) e salva in `order_captcha_passes` un pass monouso di 5 minuti per l'utente.
3. **Chi blocca è il server:** se `companies.require_turnstile = true`, `create_order_with_items` (via `assert_order_antiabuse`) consuma il pass e, senza pass, rifiuta con `ANTIABUSE_CAPTCHA_REQUIRED`. Un bot che chiama la RPC direttamente non passa.
4. Il token vale una volta sola: dopo ogni invio fallito il widget si resetta e ne genera uno nuovo.

Scelta per le chiavi mancanti (il checkout di prod non deve rompersi):
- Nessuna site key (prod oggi): nessun widget, nessuna chiamata alla funzione, `require_turnstile = false`. Tutto come prima.
- Site key presente ma funzione non deployata (404), senza secret o con secret sbagliata (503), token scaduto (409), Cloudflare o rete giù: l'ordine parte lo stesso e decide il server. Con `require_turnstile = false` passa; con `true` serve un pass valido.
- Solo un token rifiutato da Cloudflare (403/400) ferma il checkout lato client, con il messaggio "Conferma di non essere un robot e riprova".
- Si accende l'obbligo (`require_turnstile = true`) solo per ultimo, dopo aver visto un ordine di prova passare con il widget. Accenderlo prima blocca tutti gli ordini.
- Gli ordini salvati offline e inviati più tardi non hanno un token: con `require_turnstile = true` vengono rifiutati e il cliente deve rifarli online.

Cosa deve fornire/configurare Carmine (nessun segreto nel repo):
1. **Cloudflare** → Turnstile → Add widget:
   - modalità *Managed*;
   - hostname: `skibidi-eight-virid.vercel.app` (più eventuale dominio proprio) e `localhost` solo se serve provarlo in locale. Le preview `*.vercel.app` non sono incluse;
   - copiare **Site key** (pubblica) e **Secret key** (segreta).
2. **Supabase** (progetto `zqubwvhstobaugifzoyb`), secret delle edge function:
   - `supabase secrets set --project-ref zqubwvhstobaugifzoyb TURNSTILE_SECRET_KEY=<secret key>`
   - facoltativa: `supabase secrets set --project-ref zqubwvhstobaugifzoyb TURNSTILE_ALLOWED_HOSTNAMES=skibidi-eight-virid.vercel.app`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` li fornisce già Supabase.
3. **Deploy della funzione:** `supabase functions deploy verify-turnstile --project-ref zqubwvhstobaugifzoyb` (con la verifica JWT di default: serve un utente loggato).
4. **Vercel** (progetto `skibidi`, ambiente *Production*): `EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key>`, poi un nuovo deploy di produzione (Expo inserisce la variabile al momento della build).
5. Ordine di prova con un account Google: il widget compare, l'ordine passa.
6. Solo dopo, con l'OK: `update companies set require_turnstile = true where id = '00000000-0000-0000-0000-000000000001';`

Per spegnere: `require_turnstile = false` (effetto immediato), poi eventualmente togliere la variabile su Vercel e rifare il deploy.

## Test

- SQL (PGlite, nessun DB ospitato): `npm i --no-save @electric-sql/pglite && node tests/sql/run-antiabuse-pglite.mjs`. Se nel checkout c'è anche #18 applica le sue migration e il suo test (combo #11+#18+#20).
- Merge con #18: in `tests/sql/atomic-order-submission.sql` tenere la versione di #20 (funziona con e senza #18).
- Unit: `npx vitest run tests/unit` (Turnstile: `tests/unit/verifyTurnstile.spec.ts`, edge function e passo del checkout con mock di Cloudflare e Supabase)
