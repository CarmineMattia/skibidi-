-- Backup (SOLA LETTURA) dei 16 ordini senza order_items, prima della pulizia.
-- Vedi docs/piano-dati-2026-10-21.md, opzione 4. Non modifica nulla.
--
-- Uso (solo con l'OK di Carmine, prima di cleanup-empty-orders-2026-10.sql):
--   1. Eseguire questo file (SQL editor di Supabase o execute_sql). Restituisce UNA riga.
--   2. Salvare la colonna `backup` in /workspace/backups/<ts>-pre-cleanup-empty-orders/backup.json
--      e controllare: order_count = 16, item_count = 0, ref_count = 0.
--      La colonna contiene anche `sha256`: checksum del contenuto, ricontrollato dal ripristino
--      (un backup modificato o troncato viene rifiutato). Calcolato con TimeZone UTC sulle righe
--      tipizzate come public.orders, quindi non cambia se il JSON passa per un parser (13.50 -> 13.5)
--      o se cambia l'ordine delle chiavi.
--   3. Generare lo script di ripristino già pronto:
--        node scripts/sql/make-restore-empty-orders.mjs backup.json > restore-filled.sql
--
-- Il backup contiene i dati completi delle righe (anche nome/telefono/indirizzo se presenti):
-- tenerlo solo nella cartella di backup, MAI nel repo.
BEGIN READ ONLY;
SET LOCAL TimeZone = 'UTC';  -- date del backup e checksum sempre in UTC

WITH ids(id) AS (
  SELECT unnest(ARRAY[
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
  ]::uuid[])
),
doc AS (
  SELECT jsonb_build_object(
    'kind', 'skibidi-cleanup-empty-orders-2026-10',
    'taken_at', now(),
    'ids', (SELECT jsonb_agg(id ORDER BY id) FROM ids),
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at, o.id)
                        FROM public.orders o WHERE o.id IN (SELECT id FROM ids)), '[]'::jsonb),
    'order_items', COALESCE((SELECT jsonb_agg(to_jsonb(oi))
                             FROM public.order_items oi WHERE oi.order_id IN (SELECT id FROM ids)), '[]'::jsonb),
    'fiscal_audit_log', COALESCE((SELECT jsonb_agg(to_jsonb(f))
                                  FROM public.fiscal_audit_log f WHERE f.order_id IN (SELECT id FROM ids)), '[]'::jsonb),
    'fiscal_retry_queue', COALESCE((SELECT jsonb_agg(to_jsonb(f))
                                    FROM public.fiscal_retry_queue f WHERE f.order_id IN (SELECT id FROM ids)), '[]'::jsonb),
    'order_no_shows', COALESCE((SELECT jsonb_agg(to_jsonb(n))
                                FROM public.order_no_shows n WHERE n.order_id IN (SELECT id FROM ids)), '[]'::jsonb),
    'totals', jsonb_build_object(
      'orders_total', (SELECT count(*) FROM public.orders),
      'order_items_total', (SELECT count(*) FROM public.order_items),
      'empty_orders_total', (SELECT count(*) FROM public.orders o
                             WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)))
  ) AS d
)
SELECT
  (SELECT count(*) FROM public.orders o WHERE o.id IN (SELECT id FROM ids)) AS order_count,
  (SELECT count(*) FROM public.order_items oi WHERE oi.order_id IN (SELECT id FROM ids)) AS item_count,
  (SELECT count(*) FROM public.fiscal_audit_log f WHERE f.order_id IN (SELECT id FROM ids))
  + (SELECT count(*) FROM public.fiscal_retry_queue f WHERE f.order_id IN (SELECT id FROM ids))
  + (SELECT count(*) FROM public.order_no_shows n WHERE n.order_id IN (SELECT id FROM ids)) AS ref_count,
  -- sha256 del contenuto canonico: lo stesso calcolo è nel ripristino (tenerli uguali)
  doc.d || jsonb_build_object('sha256', encode(sha256(convert_to((
    (doc.d - 'sha256' - 'orders') || jsonb_build_object('orders',
      (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
       FROM jsonb_populate_recordset(NULL::public.orders, doc.d->'orders') r))
  )::text, 'UTF8')), 'hex')) AS backup
FROM doc;

ROLLBACK;
