-- Pulizia una tantum: cancella i 16 vecchi ordini senza order_items (giugno-settembre 2026).
-- Vedi docs/piano-dati-2026-10-21.md, opzione 4. NON è una migration.
--
-- Eseguire SOLO con l'OK esplicito di Carmine e SOLO dopo il backup
-- (cleanup-empty-orders-2026-10-backup.sql, salvato in /workspace/backups/<ts>-pre-cleanup-empty-orders/).
--
-- Una sola transazione. Annulla tutto (nessuna riga cancellata) se:
--   - gli ordini con questi id non sono esattamente 16;
--   - anche uno solo ha order_items, oppure righe in fiscal_audit_log, fiscal_retry_queue o order_no_shows;
--   - il DELETE non cancella esattamente 16 righe.
-- Le 16 righe vengono bloccate (FOR UPDATE) prima dei controlli: nessuno può aggiungere
-- righe d'ordine a questi ordini tra il controllo e il DELETE.
-- Rieseguirlo dopo una pulizia riuscita fallisce (trova 0 ordini) e non cambia nulla.
BEGIN;

DO $cleanup$
DECLARE
  target_ids uuid[] := ARRAY[
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
  found_count int;
  bad_count int;
  deleted_count int;
BEGIN
  IF cardinality(target_ids) <> 16
     OR (SELECT count(DISTINCT x) FROM unnest(target_ids) AS x) <> 16 THEN
    RAISE EXCEPTION 'CLEANUP_ABORT: la lista deve contenere 16 id distinti';
  END IF;

  PERFORM 1 FROM public.orders WHERE id = ANY (target_ids) FOR UPDATE;
  GET DIAGNOSTICS found_count = ROW_COUNT;
  IF found_count <> 16 THEN
    RAISE EXCEPTION 'CLEANUP_ABORT: attesi 16 ordini, trovati %', found_count;
  END IF;

  SELECT count(*) INTO bad_count FROM public.order_items WHERE order_id = ANY (target_ids);
  IF bad_count <> 0 THEN
    RAISE EXCEPTION 'CLEANUP_ABORT: % order_items collegati (attesi 0)', bad_count;
  END IF;

  SELECT (SELECT count(*) FROM public.fiscal_audit_log WHERE order_id = ANY (target_ids))
       + (SELECT count(*) FROM public.fiscal_retry_queue WHERE order_id = ANY (target_ids))
       + (SELECT count(*) FROM public.order_no_shows WHERE order_id = ANY (target_ids))
    INTO bad_count;
  IF bad_count <> 0 THEN
    RAISE EXCEPTION 'CLEANUP_ABORT: % righe fiscali/mancati ritiri collegate (attese 0)', bad_count;
  END IF;

  DELETE FROM public.orders o
  WHERE o.id = ANY (target_ids)
    AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 16 THEN
    RAISE EXCEPTION 'CLEANUP_ABORT: cancellati % ordini (attesi 16)', deleted_count;
  END IF;

  RAISE NOTICE 'CLEANUP_OK: cancellati % ordini senza righe', deleted_count;
END
$cleanup$;

COMMIT;

-- Verifica dopo (sola lettura): ordini totali -16 rispetto al backup, nessun ordine senza righe.
SELECT
  (SELECT count(*) FROM public.orders) AS orders_total,
  (SELECT count(*) FROM public.order_items) AS order_items_total,
  (SELECT count(*) FROM public.orders o
   WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)) AS empty_orders_total;
