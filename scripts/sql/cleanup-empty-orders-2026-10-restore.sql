-- Ripristino dei 16 ordini cancellati da cleanup-empty-orders-2026-10.sql.
-- Solo in caso di problemi e con l'OK di Carmine.
--
-- Non eseguire questo file così com'è: __BACKUP_JSON__ va sostituito con la colonna `backup`
-- salvata da cleanup-empty-orders-2026-10-backup.sql. Lo fa:
--   node scripts/sql/make-restore-empty-orders.mjs <backup.json> > restore-filled.sql
--
-- Una sola transazione:
--   - controlla che il backup contenga esattamente i 16 id attesi e nessuna riga collegata;
--   - reinserisce solo gli ordini che mancano, con tutte le colonne originali (id, stato,
--     created_at, display_code...). I trigger utente di orders (es. "i nuovi ordini partono
--     pending", codice ordine) sono disattivati SOLO durante l'insert e riattivati subito;
--   - alla fine verifica che tutti i 16 ordini esistano e siano identici al backup,
--     altrimenti annulla tutto.
--   - prima di tutto ricalcola lo sha256 del backup e lo confronta con il campo `sha256`
--     scritto dal backup: se il file è stato modificato a mano o è incompleto, annulla.
-- Si può rieseguire: se gli ordini sono già presenti e identici non cambia nulla.
--
-- DA SAPERE PRIMA DI ESEGUIRLO
--   - ALTER TABLE orders DISABLE/ENABLE TRIGGER USER: serve il proprietario di orders (postgres)
--     e prende un lock (SHARE ROW EXCLUSIVE) su orders fino al COMMIT. In quei secondi i nuovi
--     ordini e gli aggiornamenti di stato restano in attesa (le letture no). Le altre sessioni
--     non vedono mai i trigger spenti: il lock le fa aspettare e al COMMIT sono già riattivati.
--     Eseguirlo comunque a pizzeria chiusa.
--   - I 16 ordini reinseriti escono sulla pubblicazione supabase_realtime come INSERT: una
--     schermata cucina/admin aperta in quel momento li riceve come "nuovi ordini" (sono
--     annullati o consegnati, ma possono comparire o suonare). Chiudere o ricaricare le
--     schermate cucina dopo il ripristino.
BEGIN;
SET LOCAL TimeZone = 'UTC';  -- come il backup: stesso testo per date e checksum

CREATE TEMP TABLE _cleanup_backup (doc jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO _cleanup_backup (doc) VALUES ($backup$__BACKUP_JSON__$backup$::jsonb);

DO $restore$
DECLARE
  expected_ids uuid[] := ARRAY[
    'd7c6ef59-9d66-43ab-9860-f67b79f8fdbc', --  1 2026-06-12 cancelled 850.00
    '0d8630d9-0aa1-421f-837a-4a51ddbc70da', --  2 2026-07-15 cancelled  14.00
    'aaa97d25-ac70-4429-8ec8-6e6503aca940', --  3 2026-07-19 delivered  10.50
    'dab829b7-64ca-4f68-a800-d0fbccd4a6a1', --  4 2026-07-19 delivered  10.50
    'd8a58667-3882-41b6-bbfb-efb7e4e37a97', --  5 2026-07-19 delivered  10.50
    '009bd01a-eeff-4f2c-8589-ccb71c3fd1f6', --  6 2026-09-01 delivered  13.50
    '9d11aabe-b8dc-421d-b41e-078f74406f4d', --  7 2026-09-01 delivered  13.50
    'badeb3fc-896b-472f-8e0c-003f0af9c6a3', --  8 2026-09-01 cancelled  10.50
    'f576eafc-d91e-4a62-bb40-115d05587a49', --  9 2026-09-01 cancelled   8.50
    '7d3e2aba-a827-4d28-af73-4e1b673551e4', -- 10 2026-09-01 cancelled   8.50
    '6ef5c377-b337-4c22-af1d-6375fb2c74da', -- 11 2026-09-02 cancelled   4.50 Speck #1
    '42d385a5-c093-420b-8474-392d3f0cb8af', -- 12 2026-09-02 cancelled   4.50 Carbonara #2
    '0d050c47-a5f1-456c-9aec-8e2b7ca9ced2', -- 13 2026-09-04 delivered  21.50 Patate #3
    'df6129d5-bba1-4133-87c8-6c0e4097522e', -- 14 2026-09-19 delivered  22.00 Norma #2
    '647a7ff6-a669-4dc5-916c-29b392aec653', -- 15 2026-09-25 cancelled  26.00 Marinara #1
    'a1af41ad-53f6-49f6-ab3b-cd3c884514ff'  -- 16 2026-09-25 cancelled  33.00 Gamberi #2
  ]::uuid[];
  doc jsonb;
  backup_ids uuid[];
  missing_count int;
  restored_count int;
  mismatch_count int;
BEGIN
  SELECT b.doc INTO doc FROM _cleanup_backup b;
  IF doc->>'kind' IS DISTINCT FROM 'skibidi-cleanup-empty-orders-2026-10' THEN
    RAISE EXCEPTION 'RESTORE_ABORT: il file non è un backup di cleanup-empty-orders-2026-10';
  END IF;

  -- checksum: stesso calcolo di cleanup-empty-orders-2026-10-backup.sql (tenerli uguali)
  IF doc->>'sha256' IS NULL OR doc->>'sha256' IS DISTINCT FROM encode(sha256(convert_to((
       (doc - 'sha256' - 'orders') || jsonb_build_object('orders',
         (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
          FROM jsonb_populate_recordset(NULL::public.orders, doc->'orders') r))
     )::text, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'RESTORE_ABORT: checksum sha256 del backup mancante o diverso (backup modificato o incompleto)';
  END IF;

  SELECT array_agg((e->>'id')::uuid ORDER BY (e->>'id')) INTO backup_ids
  FROM jsonb_array_elements(doc->'orders') e;
  IF backup_ids IS NULL OR cardinality(backup_ids) <> 16
     OR NOT (backup_ids @> expected_ids AND backup_ids <@ expected_ids) THEN
    RAISE EXCEPTION 'RESTORE_ABORT: il backup non contiene esattamente i 16 ordini attesi';
  END IF;
  IF jsonb_array_length(COALESCE(doc->'order_items', '[]')) <> 0
     OR jsonb_array_length(COALESCE(doc->'fiscal_audit_log', '[]')) <> 0
     OR jsonb_array_length(COALESCE(doc->'fiscal_retry_queue', '[]')) <> 0
     OR jsonb_array_length(COALESCE(doc->'order_no_shows', '[]')) <> 0 THEN
    RAISE EXCEPTION 'RESTORE_ABORT: il backup contiene righe collegate: ripristino manuale';
  END IF;

  SELECT count(*) INTO missing_count
  FROM unnest(expected_ids) AS x(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = x.id);

  IF missing_count > 0 THEN
    ALTER TABLE public.orders DISABLE TRIGGER USER;
    INSERT INTO public.orders
    SELECT r.*
    FROM jsonb_populate_recordset(NULL::public.orders, doc->'orders') AS r
    WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = r.id);
    GET DIAGNOSTICS restored_count = ROW_COUNT;
    ALTER TABLE public.orders ENABLE TRIGGER USER;
    IF restored_count <> missing_count THEN
      RAISE EXCEPTION 'RESTORE_ABORT: reinseriti % ordini, attesi %', restored_count, missing_count;
    END IF;
  ELSE
    restored_count := 0;
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM jsonb_array_elements(doc->'orders') e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = (e->>'id')::uuid
      AND to_jsonb(o) = to_jsonb(jsonb_populate_record(NULL::public.orders, e))
  );
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'RESTORE_ABORT: % ordini diversi dal backup dopo il ripristino', mismatch_count;
  END IF;

  RAISE NOTICE 'RESTORE_OK: reinseriti % ordini (16 presenti e identici al backup)', restored_count;
END
$restore$;

COMMIT;
