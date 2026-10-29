# Storia delle migration: repo e prod

_Stato al 2026-10-29. Nulla di quanto segue è stato applicato: sono istruzioni per quando Carmine darà l'OK._

## Cosa cambia in questa PR (solo file del repo)
Prima, `supabase db push` falliva perché 3 versioni erano duplicate nel repo, 6 migration esistevano solo su prod e `20260904` non è su prod. La versione (il prefisso numerico) è la chiave di `supabase_migrations.schema_migrations`: due file con la stessa versione non possono avere due righe.

| File (prima) | File (dopo) | Riga su prod oggi | Azione su prod |
|---|---|---|---|
| `20260210_fiscal_tables` | `20260210152523_fiscal_tables` | `20260210152523` | nessuna (solo nome, cosmetico) |
| `20260210_performance_indexes` | `20260210152537_performance_indexes` | `20260210152537` | nessuna (solo nome, cosmetico) |
| `20260210_prod_rls_fix` | `20260210152600_prod_rls_fix` | **assente** | registrare senza eseguire (superata) |
| `20260711_order_display_code` | `20260711000000_order_display_code` | `20260901221035` | rinominare |
| `20260711_pizza_capacity_snapshot` | `20260711000100_pizza_capacity_snapshot` | assente (funzione già live) | registrare senza eseguire |
| `20260711_shift_dough_usage` | `20260711000200_shift_dough_usage` | assente (funzione già live) | registrare senza eseguire |
| `20261013_enable_rls_order_daily_counters` | `20261012234356_enable_rls_order_daily_counters` | `20261012234356` | nessuna (solo nome, cosmetico) |
| `20261013_order_status_manual_approval_enum` | `20261013000100_order_status_manual_approval_enum` | `20261020061734` | rinominare |
| `20261013_order_manual_approval_guard` | `20261013000200_order_manual_approval_guard` | `20261020061747` | rinominare |
| `20260901_fix_guest_order_items_rls` | `20260901000000_fix_guest_order_items_rls` | `20260901` | rinominare |

Perché questi numeri:
- Dove prod ha già una versione che mantiene l'ordine (`20260210152523`, `20260210152537`, `20261012234356`) uso quella: zero repair.
- Le altre sono versioni sintetiche che mantengono l'ordine di applicazione. `enum` va prima di `guard`, come su prod (prima l'alfabeto li metteva al contrario).
- `20260901_` ordinato per nome file finiva **dopo** `20260901223534_…` (le cifre vengono prima di `_`): il fix di `can_insert_order_item` sarebbe stato sovrascritto dalla versione vecchia. Da qui il rename a 14 cifre. Un test controlla l'ordine sia per nome file sia per versione.
- Contenuto dei file rinominati: invariato (`git mv`).

Le 6 migration solo su prod sono ricostruite dal campo `statements` di `schema_migrations` (lettura): `20260117194108` (bucket Storage `products` e 4 policy), `20260724140614`, `20260724143416`, `20260724152401` (demo branding, contatti, foto), `20260901223534`, `20260901224024` (`can_insert_order_item`). Il testo originale è conservato. Per non rompere un db nuovo o PGlite:
- bucket/policy: guardia su `storage.buckets` e `storage.objects` (già idempotente: `ON CONFLICT`, `DROP POLICY IF EXISTS`);
- le tre di dati demo: **sul tenant `…0001` (oggi "Pizzeria Ambrosia", slug `demo`) cancellerebbero nome, branding, foto e perfino la pizza chiamata "Ambrosia"**. Sono quindi no-op se le tabelle mancano o se il tenant è già "Pizzeria Ambrosia";
- `can_insert_order_item`: `CREATE OR REPLACE`, già rieseguibile (la prima versione legge `oi.price`, corretta da `unit_price` subito dopo; in plpgsql le colonne si controllano a runtime).
Su prod queste versioni sono già registrate e non vengono rieseguite.

## 1) Repair della storia su prod (da fare solo con l'OK di Carmine, dopo il merge)
Passi, nell'ordine:
1. Backup di `supabase_migrations.schema_migrations` (tutte le colonne, comprese `statements`).
2. Eseguire lo SQL qui sotto (un'unica transazione con precondizioni: si ferma se una riga non è come previsto, e rieseguirlo viene bloccato). Cambia solo `schema_migrations`, non esegue nessuna migration.
3. Verifica: 31 righe; `supabase migration list` mostra locale e remoto uguali, tranne `20260904`.
4. Solo ora `supabase db push` (vedi punto 2). **Mai `--include-all` prima del repair**: proverebbe a rieseguire migration già applicate (anche `prod_rls_fix` e le demo).

Le tre righe da registrare senza eseguire si possono anche fare con la CLI: `supabase migration repair --status applied 20260210152600 20260711000100 20260711000200`. Per i rename la CLI non basta (`--status reverted <vecchia>` e poi `applied <nuova>` perderebbe `statements`): meglio lo SQL.

Perché non eseguirle: `prod_rls_fix` è superata (le sue policy e `is_admin(uuid)` non esistono su prod, sostituite da `20260715120000_consolidate_tighten_admin_rls`); eseguirla potrebbe reintrodurre policy più larghe. `pizza_capacity_snapshot` e `shift_dough_usage` sono già live con corpo identico, ma i loro `GRANT … TO anon` verrebbero poi richiusi da `20261020120000`: meglio solo registrarle.

```sql
BEGIN;
DO $a$ BEGIN IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260901' AND name='fix_guest_order_items_rls') OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260901000000') THEN RAISE EXCEPTION 'precondition failed for 20260901->20260901000000'; END IF; END $a$;
UPDATE supabase_migrations.schema_migrations SET version='20260901000000', name='fix_guest_order_items_rls' WHERE version='20260901' AND name='fix_guest_order_items_rls';
DO $a$ BEGIN IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260901221035' AND name='order_display_code') OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260711000000') THEN RAISE EXCEPTION 'precondition failed for 20260901221035->20260711000000'; END IF; END $a$;
UPDATE supabase_migrations.schema_migrations SET version='20260711000000', name='order_display_code' WHERE version='20260901221035' AND name='order_display_code';
DO $a$ BEGIN IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261020061734' AND name='20261013_order_status_manual_approval_enum') OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013000100') THEN RAISE EXCEPTION 'precondition failed for 20261020061734->20261013000100'; END IF; END $a$;
UPDATE supabase_migrations.schema_migrations SET version='20261013000100', name='order_status_manual_approval_enum' WHERE version='20261020061734' AND name='20261013_order_status_manual_approval_enum';
DO $a$ BEGIN IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261020061747' AND name='20261013_order_manual_approval_guard') OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013000200') THEN RAISE EXCEPTION 'precondition failed for 20261020061747->20261013000200'; END IF; END $a$;
UPDATE supabase_migrations.schema_migrations SET version='20261013000200', name='order_manual_approval_guard' WHERE version='20261020061747' AND name='20261013_order_manual_approval_guard';
-- cosmetico: solo il nome (la CLI abbina per versione)
UPDATE supabase_migrations.schema_migrations SET name='fiscal_tables' WHERE version='20260210152523' AND name='20260210_fiscal_tables';
UPDATE supabase_migrations.schema_migrations SET name='performance_indexes' WHERE version='20260210152537' AND name='20260210_performance_indexes';
UPDATE supabase_migrations.schema_migrations SET name='enable_rls_order_daily_counters' WHERE version='20261012234356' AND name='20261013_enable_rls_order_daily_counters';
-- registrate senza eseguirle (la CLI, con `migration repair --status applied`, fa lo stesso)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
SELECT '20260210152600', 'prod_rls_fix', ARRAY['-- superseded: policies/is_admin(uuid) of this file are absent on prod and were replaced by 20260715120000_consolidate_tighten_admin_rls; NOT executed, only recorded']
WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260210152600');
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
SELECT '20260711000100', 'pizza_capacity_snapshot', ARRAY['-- already live (get_capacity_snapshot, body identical to the file); recorded only, NOT executed']
WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260711000100');
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
SELECT '20260711000200', 'shift_dough_usage', ARRAY['-- already live (get_shift_dough_usage, body identical to the file); recorded only, NOT executed']
WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260711000200');
-- controllo prima del COMMIT: devono risultare 31 righe
SELECT count(*) AS righe FROM supabase_migrations.schema_migrations;
COMMIT;
```

Risultato atteso (simulato in PGlite sul backup di prod, non su prod): 31 righe, tutte le versioni uguali ai file del repo tranne `20260904`.

## 2) `20260904_order_display_code_sequential`: applicare o saltare
Cos'è: `CREATE OR REPLACE FUNCTION reserve_order_display_code` che restituisce `Ordine #N` invece di `<nome pizza> #N` (nickname a caso). Non è su prod: il live restituisce ancora il nickname.

Dopo il repair è l'unica migration locale non applicata, ed è più vecchia dell'ultima remota: `db push` la rifiuta senza `--include-all`.

**Opzione A, applicarla (consigliata, con l'OK di Carmine):**
1. Dopo il repair, `supabase db push --dry-run` deve elencare solo `20260904`.
2. `supabase db push --include-all` (o eseguire lo stesso SQL e poi `supabase migration repair --status applied 20260904`).
3. Controlli in sola lettura: `pg_get_functiondef` mostra `'Ordine #'`; `proacl` di `reserve_order_display_code` resta `{postgres=X/postgres,service_role=X/postgres}`.

Rischi:
- ACL: il file non ha `GRANT`/`REVOKE` e `CREATE OR REPLACE` conserva proprietario e permessi, quindi `anon`/`authenticated` **non** riottengono EXECUTE (chiuso da #40). Verificato in PGlite (`tests/sql/run-migration-history-pglite.mjs`).
- Formato misto: gli ordini già creati tengono il nickname, i nuovi avranno `Ordine #N`. Il client già riscrive i nickname in `Ordine #N` (`lib/utils/orderDisplayCode.ts`), quindi a schermo non cambia nulla.
- Il contatore giornaliero (`order_daily_counters`) è lo stesso: la numerazione non si azzera.
- `--include-all` è sicuro solo dopo il repair (vedi sopra); altrimenti rieseguirebbe migration già applicate.
- Reversibile: basta un `CREATE OR REPLACE` con il corpo precedente (è nel file `20260711000000_order_display_code.sql`).

**Opzione B, saltarla:** `supabase migration repair --status applied 20260904` la registra senza eseguirla. Prod resta con i nickname mentre il repo dice "Ordine #N": deriva, nascosta solo dal client. Oppure togliere il file dal repo.
