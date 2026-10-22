# TODO — Skibidi Orders (Ambrosia)

Riferimento: [piano](./SKIBIDI-ORDERS-PLAN.md). Stato aggiornato il **2026-10-22**: #35, #36 e #37 unite su main il 21/10, con l'OK di Carmine; batch #38–#42 aperto il 22/10.
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

### Unite il 21/10 (OK di Carmine, 10:55 CEST)
| PR | Cosa |
|---|---|
| #35 | Menu visibile ai clienti senza azienda: lettura del menu delle aziende attive, azienda di default ai nuovi clienti, backfill. Migration `20261020170000_customer_company_menu.sql` applicata su prod (versione `20261021085655`): i 2 profili cliente con `company_id` NULL ora hanno Ambrosia |
| #37 | Immagini: la foto in Supabase Storage vince su quella generata. Ora sul sito si vedono le 4 foto vere (Margherita, Funghi, Speciale, Crudo e Burrata) |
| #36 | Questi documenti |

### Aperte
Batch del 22/10 (nessuna unita; merge e migration solo con l'OK di Carmine, niente eseguito su prod):
- [ ] **#38** `chore/cleanup-empty-orders`: script di backup, pulizia e ripristino dei 16 ordini vuoti (opzione 4 del piano dati). Non eseguiti. Fix del round22 (`b71015c`): dry-run predefinito (cancella solo con flag esplicito), checksum sha256 del backup verificato dal ripristino, note su lock dei trigger e INSERT realtime in cucina
- [ ] **#39** `fix/admin-editor-preserve-fields`: l'editor admin salva solo i campi cambiati (non riattiva i prodotti spenti, non azzera l'ordine nel menu). Include `baseURL` Playwright su `localhost`. Skibidi Tester round22: PASS
- [ ] **#40** `fix/order-notes-hardening`: note ordine pulite (zero-width/bidi/invisibili; ZWJ tra emoji e bandiere a tag tenuti), 1000 caratteri di testo libero per riga (tetto riga 8000, nota ordine 1000), `reserve_order_display_code` solo server, menu anon solo prodotti/categorie attivi. Migration `20261022100000_order_notes_menu_hardening.sql` solo nella PR, **non applicata**. Fix del round22 (`56fce27`): pulizia in un solo punto, così il retry con lo stesso id non viene più rifiutato quando la nota contiene caratteri tolti
- [ ] **#41** `feat/turnstile-checkout`: Turnstile end to end (widget + `verify-turnstile`), chiavi solo da env. Non deployato: chiavi e impostazioni da fornire in `docs/ANTIABUSE.md`. Skibidi Tester round22: PASS. Rifinitura (`96186cc`): timeout 5 s su siteverify e sul client, il checkout si ferma solo con `turnstile_failed` (problemi di provider/configurazione non bloccano con `require_turnstile = false`), azione obbligatoria, niente `remoteip`, spec anche su `/modal`
- [ ] **#42** `docs/status-2026-10-22`: questi documenti. Skibidi Tester round22: PASS

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
| #35 | `20261020170000_customer_company_menu.sql` | `20261021085655` | applicata (21/10) |

Verifica degli oggetti di #18 e #20, oltre alla storia delle migration:
- **#18:** l'enum `order_status` ha pending, accepted, preparing, ready, delivered, cancelled e rejected. Esistono `accepted_at`/`accepted_by` e i trigger `trg_enforce_order_manual_approval` e `trg_prevent_empty_order_acceptance`.
- **#20:** esistono `assert_order_antiabuse`, `mark_order_no_show` e `set_customer_blocked`, le colonne antiabuso su `companies` e le tabelle `customer_restrictions`, `order_no_shows` e `order_captcha_passes`.

File presenti nel repo ma assenti dalla storia di prod, con gli oggetti già presenti live (applicati a mano in passato):
- `20260904_order_display_code_sequential.sql` → presenti `reserve_order_display_code(uuid)` e `trg_orders_display_code`;
- `20261008_atomic_order_submission.sql` → presente `create_order_with_items`, poi sostituita da #32 e #33;
- `20260711_pizza_capacity_snapshot.sql` / `20260711_shift_dough_usage.sql` → presenti le funzioni;
- `20260715121500_enable_orders_realtime.sql` → `orders` è nella pubblicazione `supabase_realtime`.

Per allineare la storia basta un `migration repair`, che è solo registrazione e va comunque fatto con l'OK di Carmine.

**Tutte le migration delle PR unite sono applicate. Nessuna attende l'OK.**

## Seguiti aperti
### CI e test
- [ ] Far girare in CI vitest e i runner SQL PGlite (`tests/sql/run-*-pglite.mjs`). Oggi il job "Tests (Future)" è un segnaposto
### Ordini e note
- [ ] Limite di lunghezza delle note lato server (in #40)
- [ ] Caratteri zero-width e bidi (RTL) nelle note: rifiutarli o ripulirli (in #40)
- [ ] Titolo della card "mezzo metro" in cucina e in admin
- [ ] Setter della consegna in admin: arrotondare ai centesimi (il server rifiuta più di 2 decimali)
- [ ] Client fiscali vecchi in cache rifiutati: messaggio chiaro e ricarica
- [ ] Il cliente può segnare da solo la ricevuta come `success` (finestra `pending` di #34): spostare le ricevute sul server
- [ ] `/order-success` con un orderId falso mostra "Ordine #N" e "non verificabile" invece di "non trovato"
- [ ] Chi può annullare un ordine già accettato (solo admin o anche il cliente)
### Permessi DB
- [ ] Revocare `reserve_order_display_code` ad `authenticated` (serve solo dentro `create_order_with_items`) (in #40)
- [ ] `anon` ha ancora MAINTAIN su `orders`/`order_items`. Restano anche i default privileges di `supabase_admin` su `public`
- [ ] Default privileges dello schema `storage`
- [ ] `anon` legge via API prodotti inattivi e aziende inattive: limitare a quelli attivi (in #40)
### Test e immagini (Skibidi Tester, round21)
- [ ] (in #39) Playwright: `baseURL` su `localhost`, non `127.0.0.1` (`127.0.0.1` viene letto come sottodominio di un'azienda da `TenantContext`)
- [ ] (Opzionale) Rafforzare la precedenza delle foto: accettare solo l'host Storage del nostro progetto (`zqubwvhstobaugifzoyb.supabase.co`), non qualsiasi `*.supabase.co`
- [ ] `image_url` fatto di soli spazi: trattarlo come vuoto anche lato DB e admin
### Admin
- [ ] L'editor prodotto in admin, al salvataggio, manda sempre `active: true`, `display_order: 0` e gli ingredienti vuoti se il campo è vuoto: riattiva i prodotti inattivi e ne perde l'ordine. In #39
### Web
- [ ] Titoli pagina vuoti su `/menu`, `/account` e `/order-tracking`
### Antiabuso e pagamenti
- [ ] (Facoltativo, round22) Con la site key attiva: disattivare "Conferma ordine" finché il widget non ha dato un token
- [ ] Turnstile: serve prima il deploy della edge function `verify-turnstile` (codice in #41, chiavi da Carmine)
- [ ] Edge function Stripe: tenere per la v2 o cancellare
- [ ] Confermare i limiti antiabuso (€150, 2 ordini aperti, 3 ogni 10 min, blocco dopo 3 mancati ritiri)
### Dati (vedi [piano-dati-2026-10-21.md](./piano-dati-2026-10-21.md), serve l'OK di Carmine)
- [ ] 16 vecchi ordini senza `order_items` (script in #38, da eseguire solo con l'OK)
- [ ] 11 prodotti senza foto (5 Al metro, Stria, 5 dolci): aspettiamo le foto di Carmine
- [x] Le 4 foto vere in Storage (Margherita, Funghi, Speciale, Crudo e Burrata) ora si vedono sul sito: la foto in Storage vince su quella generata (#37)
### POS
- [ ] Integrazione con il POS Windows 10 (vedi sopra)

## Fatto (prima annotato come aperto)
- [x] Bottone admin "Non ritirato" (#26)
- [x] Errore React #418 (#25 + #29)
- [x] #11: funzioni atomiche presenti live, poi sostituite da #32 e #33 (manca solo il `migration repair`, vedi sopra)

## Rimandato
- Bot WhatsApp
