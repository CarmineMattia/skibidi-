# TODO — Skibidi Orders (Ambrosia)

Riferimento: [piano](./SKIBIDI-ORDERS-PLAN.md). Stato aggiornato il **2026-10-21** (main @ `5d0e9c7`).
Piano per ordini vuoti e foto mancanti: [piano-dati-2026-10-21.md](./piano-dati-2026-10-21.md).

## POS / integrazione
- [ ] Chiedere al proprietario il nome del gestionale/POS
- [ ] Ottenere il contatto del fornitore e chiedere se c'è un'API o un import da file
- [ ] Verificare l'edizione di Windows 10 e i permessi sulla cassa
- [ ] Scegliere l'integrazione (API > import file > fornitore > Rakijazios GUI)
- [ ] Fase temporanea: dashboard ordini su Chrome alla cassa

## Stato PR (2026-10-21)

### Unite su main (orari CEST)
| PR | Cosa | Unita |
|---|---|---|
| #19 | Checkout: solo pagamento alla cassa | 13/10 16:03 |
| #21 | Upsell bevande: il primo tap non si perde più | 13/10 15:53 |
| #23 | e2e: guardia prod per login reali e scritture | 14/10 12:39 |
| #22 | Docs: stato al 14/10 | 14/10 12:45 |
| #24 | e2e: guardia prod più robusta | 16/10 09:48 |
| #25 | Web: errore di idratazione React #418 (prima parte) | 20/10 07:54 |
| #27 | Controllo immagini prodotti + report | 20/10 07:56 |
| #17 | Login solo con Google | 20/10 08:00 |
| #20 | Antiabuso lato DB (migration applicata) | 20/10 08:00 |
| #18 | Approvazione manuale + nuovi stati (migration applicate) | 20/10 08:16 |
| #26 | Admin: bottone "Non ritirato" | 20/10 08:28 |
| #28 | DB: EXECUTE e `search_path` sulle funzioni SECURITY DEFINER (migration applicata) | 20/10 11:08 |
| #30 | DB: via TRUNCATE/TRIGGER/REFERENCES e default privileges (migration applicata) | 20/10 11:12 |
| #32 | DB: `create_order_with_items` unica via per scrivere `order_items` (migration applicata) | 20/10 11:17 |
| #33 | Prezzi calcolati sul server, tabella `menu_pricing` (migration applicata) | 20/10 17:11 |
| #34 | Ordine bloccato per il cliente dopo la creazione (migration applicata) | 20/10 17:15 |
| #29 | Vercel: un HTML per rotta, niente rewrite catch-all (React #418) | 20/10 17:19 |
| #31 | Menu: via le voci ospite, solo "Accedi con Google" | 20/10 17:22 |

Deploy Vercel di `5d0e9c7` completato il 20/10 alle 17:27. Controllo in sola lettura: `/`, `/menu` e rotte profonde rispondono 200, una rotta inesistente 404, nessun errore #418 in console.

### Aperte
- [ ] **#35** `fix/customer-company-menu`. Il menu era vuoto per i clienti con `company_id` NULL, cioè ogni signup Google (2 profili live). Rende il menu delle aziende attive leggibile ai clienti, assegna l'azienda ai nuovi clienti e fa il backfill. Skibidi Tester: **PASS**. **Serve l'OK di Carmine** per il merge e la migration `20261020170000_customer_company_menu.sql`.

## Migration su prod (`list_migrations`, 2026-10-21)
Le versioni su prod sono l'ora di applicazione, non il timestamp del file. Il confronto è fatto per nome e contenuto.

| PR | File | Versione prod | Stato |
|---|---|---|---|
| #18 | `20261013_order_status_manual_approval_enum.sql` | `20261020061734` | applicata |
| #18 | `20261013_order_manual_approval_guard.sql` | `20261020061747` | applicata |
| #20 | `20261013140000_order_antiabuse.sql` | `20261020060111` | applicata |
| #28 | `20261020120000_security_definer_grants.sql` | `20261020090834` | applicata |
| #30 | `20261020130000_db_hardening_truncate_defaults.sql` | `20261020091257` | applicata |
| #32 | `20261020140000_order_items_insert_guard.sql` | `20261020091715` | applicata |
| #33 | `20261020150000_server_side_pricing.sql` | `20261020151133` | applicata |
| #34 | `20261020160000_customer_order_update_lock.sql` | `20261020151554` | applicata |
| #35 | `20261020170000_customer_company_menu.sql` | — | **non applicata: attende l'OK di Carmine** |

Verifica degli oggetti di #18 e #20, oltre alla storia delle migration:
- **#18:** l'enum `order_status` ha pending, accepted, preparing, ready, delivered, cancelled e rejected. Esistono `accepted_at`/`accepted_by` e i trigger `trg_enforce_order_manual_approval` e `trg_prevent_empty_order_acceptance`.
- **#20:** esistono `assert_order_antiabuse`, `mark_order_no_show` e `set_customer_blocked`, le colonne antiabuso su `companies` e le tabelle `customer_restrictions`, `order_no_shows` e `order_captcha_passes`.

File presenti nel repo ma assenti dalla storia di prod, con gli oggetti già presenti live (applicati a mano in passato):
- `20260904_order_display_code_sequential.sql` → presenti `reserve_order_display_code(uuid)` e `trg_orders_display_code`;
- `20261008_atomic_order_submission.sql` → presente `create_order_with_items`, poi sostituita da #32 e #33;
- `20260711_pizza_capacity_snapshot.sql` / `20260711_shift_dough_usage.sql` → presenti le funzioni;
- `20260715121500_enable_orders_realtime.sql` → `orders` è nella pubblicazione `supabase_realtime`.

Per allineare la storia basta un `migration repair`, che è solo registrazione e va comunque fatto con l'OK di Carmine.

**Nessuna migration delle PR unite attende l'OK. Resta solo #35.**

## Seguiti aperti
### CI e test
- [ ] Far girare in CI vitest e i runner SQL PGlite (`tests/sql/run-*-pglite.mjs`). Oggi il job "Tests (Future)" è un segnaposto
### Ordini e note
- [ ] Limite di lunghezza delle note lato server
- [ ] Caratteri zero-width e bidi (RTL) nelle note: rifiutarli o ripulirli
- [ ] Titolo della card "mezzo metro" in cucina e in admin
- [ ] Setter della consegna in admin: arrotondare ai centesimi (il server rifiuta più di 2 decimali)
- [ ] Client fiscali vecchi in cache rifiutati: messaggio chiaro e ricarica
- [ ] Il cliente può segnare da solo la ricevuta come `success` (finestra `pending` di #34): spostare le ricevute sul server
- [ ] `/order-success` con un orderId falso mostra "Ordine #N" e "non verificabile" invece di "non trovato"
- [ ] Chi può annullare un ordine già accettato (solo admin o anche il cliente)
### Permessi DB
- [ ] Revocare `reserve_order_display_code` ad `authenticated` (serve solo dentro `create_order_with_items`)
- [ ] `anon` ha ancora MAINTAIN su `orders`/`order_items`. Restano anche i default privileges di `supabase_admin` su `public`
- [ ] Default privileges dello schema `storage`
- [ ] `anon` legge via API prodotti inattivi e aziende inattive: limitare a quelli attivi
### Web
- [ ] Titoli pagina vuoti su `/menu`, `/account` e `/order-tracking`
### Antiabuso e pagamenti
- [ ] Turnstile: serve prima il deploy della edge function `verify-turnstile`
- [ ] Edge function Stripe: tenere per la v2 o cancellare
- [ ] Confermare i limiti antiabuso (€150, 2 ordini aperti, 3 ogni 10 min, blocco dopo 3 mancati ritiri)
### Dati (vedi [piano-dati-2026-10-21.md](./piano-dati-2026-10-21.md), serve l'OK di Carmine)
- [ ] 16 vecchi ordini senza `order_items`
- [ ] 11 prodotti senza foto (5 Al metro, Stria, 5 dolci): aspettiamo le foto di Carmine
- [ ] Le 4 foto vere in Storage (Margherita, Funghi, Speciale, Crudo e Burrata) sono coperte dalle foto generate locali di `lib/data/pizzaPhotos.ts`: decidere la precedenza
### POS
- [ ] Integrazione con il POS Windows 10 (vedi sopra)

## Fatto (prima annotato come aperto)
- [x] Bottone admin "Non ritirato" (#26)
- [x] Errore React #418 (#25 + #29)
- [x] #11: funzioni atomiche presenti live, poi sostituite da #32 e #33 (manca solo il `migration repair`, vedi sopra)

## Rimandato
- Bot WhatsApp
