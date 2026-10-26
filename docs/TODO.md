# TODO — Skibidi Orders (Ambrosia)

Riferimento: [piano](./SKIBIDI-ORDERS-PLAN.md). Stato aggiornato il **2026-10-26** (main @ `970a3d1`, merge di #50).
Piano per ordini vuoti e foto mancanti: [piano-dati-2026-10-21.md](./piano-dati-2026-10-21.md).

## POS / integrazione
- [ ] Chiedere al proprietario il nome del gestionale/POS (ancora sconosciuto)
- [ ] Ottenere il contatto del fornitore e chiedere se c'è un'API o un import da file
- [ ] Verificare l'edizione di Windows 10 e i permessi sulla cassa
- [ ] Scegliere l'integrazione (API > import file > fornitore > Rakijazios GUI)
- [ ] Fase temporanea: dashboard ordini su Chrome alla cassa

## Stato PR (2026-10-26)
Nessuna PR aperta oltre a questa. #17–#37 unite entro il 21/10 (dettaglio nella storia di questo file, PR #36 e #42).

### Unite dal 23/10 (OK di Carmine in chat)
| PR | Cosa | Merge | Unita |
|---|---|---|---|
| #43 | CI: vitest e runner SQL PGlite girano davvero | `05d9c78` | 23/10 16:58 CEST |
| #39 | Admin: l'editor salva solo i campi cambiati | `b3a513e` | 23/10 17:02 CEST |
| #40 | DB: note pulite e limitate, `reserve_order_display_code` solo server, menu anon solo attivi | `cb2d51f` | 23/10 17:05 CEST |
| #41 | Turnstile end to end (codice; non attivo) | `eee2231` | 23/10 17:10 CEST |
| #45 | `/order-success`: "Ordine non trovato" per id sconosciuti | `4908eda` | 23/10 17:14 CEST |
| #44 | Ricevuta/stato fiscale solo server o staff | `11e3099` | 23/10 17:19 CEST |
| #38 | Script backup/pulizia/ripristino dei 16 ordini vuoti (**non eseguiti**) | `3440a1f` | 23/10 17:24 CEST |
| #42 | Docs: stato al 22/10 | `84e0e7d` | 23/10 17:29 CEST |
| #46 | Scontrini in attesa emessi dallo staff, lato server | `00637de` | 23/10 20:17 CEST |
| #47 | Rifiniture demo (ordine menu, foto in evidenza, sottotitolo bevande, combo spente, pannello ricevute) | `6b0bd3c` | 25/10 10:25 CET |
| #48 | Pizze per prime nel menu e nella home | `6d71814` | 25/10 11:00 CET |
| #49 | Home: WhatsApp accanto a "Ordina le pizze", barra in alto solo Menu/Offerte/Chiama | `482b2f7` | 25/10 12:23 CET |
| #50 | Home: link veri (WhatsApp/Offerte/Chiama), verde WhatsApp AA, barra e CTA ok a 320px | `970a3d1` | 25/10 12:57 CET |

Deploy Vercel di `970a3d1` completato il 25/10 alle 13:01 CET. Controllo in sola lettura a 390×844 e 320×568: WhatsApp e "Ordina" sopra la piega, link `wa.me` con `target=_blank`, "Chiama" `tel:+3905221717681`, nessun errore in console.

## Migration su prod
Applicate il 23/10 con l'OK di Carmine (backup prima di ognuna):
- #40 `20261022100000_order_notes_menu_hardening.sql`
- #44 `20261023100000_server_side_receipt_status.sql`
- #46 `20261023140000_staff_receipt_issue.sql`

**Storia delle migration riparata il 23/10, ma non del tutto.** 14 righe rinominate alla versione del file nel repo, 2 inserite (`20260715121500`, `20261008`). `supabase db push` **fallisce ancora** per:
- versioni duplicate nel repo: `20260210` (3 file), `20260711` (3 file), `20261013` (3 file). Serve una PR che rinomini i file a versioni uniche, poi un nuovo repair;
- `20260904_order_display_code_sequential.sql` **non applicata** su prod (il live restituisce ancora "<pizza> #N"): un `db push` la applicherebbe;
- 6 righe solo su prod senza file nel repo (`20260117194108`, `20260724140614`, `20260724143416`, `20260724152401`, `20260901223534`, `20260901224024`): da aggiungere al repo in una PR.

Regola: le migration vanno solo nella PR; niente modifiche al DB live senza l'OK di Carmine.

## Cosa manca per la produzione
- [ ] **Turnstile spento:** servono le chiavi di Carmine e il deploy di `verify-turnstile` (vedi `docs/ANTIABUSE.md`)
- [ ] **16 ordini vuoti:** script in #38, pulizia **non approvata**
- [ ] **11 foto mancanti** (le manda Carmine):
  - Dolci: Profiterol, Tartufo Bianco, Tartufo Nero, Tiramisù, Torroncino, Sorbetto al Limone
  - Bianche: Stria
  - Al metro: Margherita, Metà Margherita Metà Farcita, Super Farcita, Gourmet, Farcita
- [ ] Malvasia 1/2 e 1L hanno ancora la foto di un vino rosso (1/4 sistemata il 25/10)
- [ ] Stria senza descrizione
- [ ] POS ancora sconosciuto (vedi sopra)
- [ ] Confermare che il fisso 0522 171 7681 è su WhatsApp Business (il bottone WhatsApp della home lo usa)
- [ ] Fornitore fiscale reale non integrato (seguiti di #46); **30 ordini** con ricevuta in attesa
- [ ] CI: Playwright non gira, e il job ESLint non può fallire (`continue-on-error`)

## Altri seguiti aperti
- [ ] Hero: il secondo bottone WhatsApp "Salva contatto" (QA round25)
- [ ] Titolo della card "mezzo metro" in cucina e in admin
- [ ] Setter della consegna in admin: arrotondare ai centesimi
- [ ] Client fiscali vecchi in cache rifiutati: messaggio chiaro e ricarica
- [ ] Chi può annullare un ordine già accettato (solo admin o anche il cliente)
- [ ] Permessi: `anon` ha ancora MAINTAIN su `orders`/`order_items`; default privileges di `supabase_admin` su `public` e dello schema `storage`
- [ ] (Opzionale) Precedenza foto solo per l'host Storage del progetto, non qualsiasi `*.supabase.co`
- [ ] `image_url` fatto di soli spazi: trattarlo come vuoto anche lato DB e admin
- [ ] Titoli pagina vuoti su `/menu`, `/account` e `/order-tracking`
- [ ] (Con Turnstile attivo) "Conferma ordine" disattivato finché il widget non dà un token
- [ ] Edge function Stripe: tenere per la v2 o cancellare
- [ ] Confermare i limiti antiabuso (€150, 2 ordini aperti, 3 ogni 10 min, blocco dopo 3 mancati ritiri)

## Branch vecchi (verificati il 26/10, nessuno chiuso o cancellato)
- `codex/pizza-photos-order-handoff`: 0 commit avanti, già in main con #11. Superato
- `feat/delivery-locate-and-type`: 1 commit avanti (`873a509`), contenuto già in main con #13 (squash `bd6af45`). Superato
- `cursor/fix-mobile-hero-signage-a82e`: 1 commit avanti (`87a9110`), stessa patch già in main con #10 (`d51c4d5`). Superato

## Fatto (prima annotato come aperto)
- [x] Vitest e runner SQL in CI (#43)
- [x] Note ordine: limite lato server e pulizia zero-width/bidi; `reserve_order_display_code` revocata ad `authenticated`; `anon` legge solo prodotti/aziende attivi (#40)
- [x] Editor admin non riattiva i prodotti spenti; Playwright `baseURL` su `localhost` (#39)
- [x] Il cliente non può più segnare la ricevuta come `success` (#44, #46)
- [x] `/order-success` con id falso mostra "non trovato" (#45)
- [x] Bottone admin "Non ritirato" (#26); errore React #418 (#25 + #29)

## Rimandato
- Bot WhatsApp
