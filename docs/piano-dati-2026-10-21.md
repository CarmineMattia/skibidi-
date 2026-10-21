# Piano dati: ordini vuoti e foto mancanti (2026-10-21)

Tutto quello che segue è stato letto da prod (`zqubwvhstobaugifzoyb`) **in sola lettura**. Questo documento non cambia nulla. Ogni passo che tocca dati o Storage richiede l'**OK esplicito di Carmine** e un backup prima.

## A) 16 vecchi ordini senza `order_items`

Sono ordini senza nessuna riga, creati tra giugno e settembre 2026, prima dell'invio atomico (#11, poi #32). Tutti della company `…0001` (Ambrosia), tutti con `fiscal_status = pending`. Solo uno ha un cliente collegato.

| # | id | Creato (CEST) | Stato | Totale € | Tipo | Codice |
|---|---|---|---|---|---|---|
| 1 | `d7c6ef59-9d66-43ab-9860-f67b79f8fdbc` | 2026-06-12 20:48 | cancelled | 850.00 | eat_in | — |
| 2 | `0d8630d9-0aa1-421f-837a-4a51ddbc70da` | 2026-07-15 12:00 | cancelled | 14.00 | take_away | — |
| 3 | `aaa97d25-ac70-4429-8ec8-6e6503aca940` | 2026-07-19 20:12 | delivered | 10.50 | eat_in | — |
| 4 | `dab829b7-64ca-4f68-a800-d0fbccd4a6a1` | 2026-07-19 20:16 | delivered | 10.50 | eat_in | — |
| 5 | `d8a58667-3882-41b6-bbfb-efb7e4e37a97` | 2026-07-19 20:24 | delivered | 10.50 | eat_in | — |
| 6 | `009bd01a-eeff-4f2c-8589-ccb71c3fd1f6` | 2026-09-01 15:48 | delivered | 13.50 | take_away | — |
| 7 | `9d11aabe-b8dc-421d-b41e-078f74406f4d` | 2026-09-01 15:48 | delivered | 13.50 | take_away | — |
| 8 | `badeb3fc-896b-472f-8e0c-003f0af9c6a3` | 2026-09-01 19:22 | cancelled | 10.50 | delivery | — |
| 9 | `f576eafc-d91e-4a62-bb40-115d05587a49` | 2026-09-01 22:31 | cancelled | 8.50 | take_away | — |
| 10 | `7d3e2aba-a827-4d28-af73-4e1b673551e4` | 2026-09-01 23:43 | cancelled | 8.50 | eat_in | — |
| 11 | `6ef5c377-b337-4c22-af1d-6375fb2c74da` | 2026-09-02 00:26 | cancelled | 4.50 | eat_in | Speck #1 |
| 12 | `42d385a5-c093-420b-8474-392d3f0cb8af` | 2026-09-02 00:36 | cancelled | 4.50 | eat_in | Carbonara #2 |
| 13 | `0d050c47-a5f1-456c-9aec-8e2b7ca9ced2` | 2026-09-04 13:01 | delivered | 21.50 | eat_in | Patate #3 |
| 14 | `df6129d5-bba1-4133-87c8-6c0e4097522e` | 2026-09-19 13:31 | delivered | 22.00 | take_away | Norma #2 |
| 15 | `647a7ff6-a669-4dc5-916c-29b392aec653` | 2026-09-25 22:24 | cancelled | 26.00 | take_away | Marinara #1 |
| 16 | `a1af41ad-53f6-49f6-ab3b-cd3c884514ff` | 2026-09-25 23:02 | cancelled | 33.00 | eat_in | Gamberi #2 |

**Totali:**
- 7 consegnati, per € 102.00;
- 9 annullati, per € 959.50 (di cui uno da € 850).

**Riferimenti:** nessuna riga in `fiscal_audit_log`, `fiscal_retry_queue` o `order_no_shows` punta a questi ordini. Tutte le FK verso `orders` sono `ON DELETE CASCADE`.

**Problema:** i 7 "consegnati" senza righe gonfiano le statistiche della dashboard (incasso e numero di ordini) e non si possono ristampare né verificare.

### Opzioni
1. **Lasciarli così** ed escluderli nei report (`WHERE EXISTS order_items`). Nessun rischio, ma il problema resta in ogni nuova query.
2. **Segnarli annullati con una nota** (es. `decline_reason_note = 'pulizia 2026-10: ordine senza righe'`). Restano visibili e le statistiche dei consegnati si correggono. Però si riscrive la storia dei 7 consegnati e il passaggio delivered→cancelled va contro le transizioni di #18 (servirebbe un aggiornamento come owner, aggirando i trigger).
3. **Archiviare:** copiarli in una tabella `orders_archive` (o in un export JSON), poi cancellarli dalla tabella viva. È tracciabile, ma aggiunge una tabella da mantenere e da proteggere con RLS.
4. **Cancellare dopo il backup:** export JSON completo dei 16 ordini (più lo script SQL per reinserirli), poi `DELETE` per lista esplicita di id.

### Raccomandazione: opzione 4
Sono dati di prova e sviluppo di prima del lancio, senza righe né riferimenti, inutili per cucina, cassa e fisco. Il backup permette di tornare indietro.

**Procedura proposta (solo con l'OK di Carmine):**
1. Fare il backup: `/workspace/backups/<ts>-pre-cleanup-empty-orders/` (JSON dei 16 ordini + SQL di ripristino).
2. In una transazione:
   - verificare che gli id siano esattamente questi 16 e che nessuno abbia `order_items`;
   - fare `DELETE … WHERE id IN (…16 id…)`;
   - verificare che il conteggio cancellato sia 16, altrimenti `ROLLBACK`.
3. Verificare dopo: ordini totali −16, nessun ordine senza righe, advisor invariati.

Non è una migration di schema: è un passo dati una tantum. Lo script va in una PR (es. `scripts/sql/cleanup-empty-orders-2026-10.sql`) e si esegue solo dopo l'OK.

## B) Foto prodotti

### Il conto: 55 senza `image_url` vs 11 senza foto
Prodotti attivi su prod: **85**.

| Dove viene l'immagine | Prodotti |
|---|---|
| `image_url` nel DB → Unsplash (tutte le **Bevande**) | 26 |
| `image_url` nel DB → Supabase Storage `products/ambrosia/*.jpg` (Margherita, Funghi, Speciale, Crudo e Burrata) | 4 |
| `image_url` NULL ma foto locale in `lib/data/pizzaPhotos.ts` (stesso id e stessa ricetta) | 44 |
| **Nessuna immagine** (`image_url` NULL e nessuna foto locale) | **11** |

Skibidi Tester ha contato i prodotti con `image_url` NULL nel DB: **55** (44 + 11). L'app però applica `withPizzaPhoto()` (`useProducts`, `CartItem`), che assegna le 48 foto generate locali (`assets/images/products/*-generated-*.webp`) per id e ricetta. Quindi solo **11** prodotti mostrano l'icona segnaposto. È lo stesso numero del report del 15/10 (`docs/product-images-2026-10-15.md`).

**Nota (risolta con #37, 21/10):** le 4 foto vere in Storage sono anche nella mappa locale, e prima `withPizzaPhoto()` le sostituiva con la versione generata. Ora un `image_url` su Supabase Storage vince sulla foto generata. Quindi una foto vera caricata in Storage si vede anche per i 44 prodotti che oggi usano una foto generata.

### Gli 11 prodotti senza foto (nomi dal DB live)
| Categoria | Prodotto | Prezzo € | id |
|---|---|---|---|
| Al metro | Margherita | 13.00 | `55f10930-0b4a-9cf0-41ea-4c09bf28422f` |
| Al metro | Metà Margherita Metà Farcita | 16.00 | `8e6290f1-a07f-1ae6-3ef4-89f3db338abb` |
| Al metro | Farcita | 18.00 | `35a1362c-ccd9-3e1e-09e3-d8a37c91769e` |
| Al metro | Super Farcita | 20.00 | `4d889992-35e1-5266-9d88-29f45f8d0581` |
| Al metro | Gourmet | 22.00 | `7ee570c3-28b7-f18c-ab42-eb739b2e2a64` |
| Bianche | Stria | 3.00 | `3db94745-690b-6cd6-193b-d98e2dd693c5` |
| Dolci | Profiterol | 4.00 | `fefe37de-3d38-973b-b40b-31c0356f1922` |
| Dolci | Tartufo Bianco / Nero | 4.00 | `ab1d6fa3-4388-cf59-4e0e-35a8123cb2b6` |
| Dolci | Tiramisù | 4.00 | `507be782-cab1-3d0e-3384-7773529fb335` |
| Dolci | Torroncino | 4.00 | `2ff3ba0c-52aa-cc41-8486-79094cfe10a8` |
| Dolci | Sorbetto al Limone | 2.00 | `a8a2b0d4-9a37-5150-7dcc-2fe2b3147cfc` |

**Nessuna foto viene generata:** le foto le fornisce Carmine.

### Procedura quando arrivano le foto di Carmine
1. **Formato:** JPEG (o WebP), lato lungo ≥ 1200 px, meglio quadrata 1:1 (le card ritagliano con `cover`, le foto locali sono 1254×1254), soggetto al centro, < 1 MB (limite del bucket: 5 MB).
2. **Preparazione sul box:** ritaglio quadrato centrale e ridimensionamento a 1200×1200, qualità ~85, senza EXIF. Una foto può servire più prodotti Al metro, se Carmine lo dice.
3. **Storage (serve l'OK):** bucket pubblico `products`, percorso `products/ambrosia/<slug>.jpg`, come le 4 esistenti. Esempi: `products/ambrosia/al-metro-farcita.jpg`, `products/ambrosia/stria.jpg`, `products/ambrosia/tiramisu.jpg`.
4. **`image_url` (serve l'OK):**
   - una PR con lo script SQL che aggiorna `products.image_url` per id, in una transazione con verifica del numero di righe (attese 11);
   - il backup prima;
   - l'esecuzione solo dopo l'approvazione.

   Gli 11 prodotti non sono nella mappa locale, quindi basta `image_url`.
5. **Verifica:**
   - `node scripts/check-product-images.mjs` sull'export dei prodotti (tutti con immagine);
   - controllo in sola lettura che gli URL rispondano 200 `image/*`;
   - controllo visivo di `/menu` su prod (niente e2e).
