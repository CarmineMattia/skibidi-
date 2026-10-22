-- Fixture PGlite per scripts/sql/cleanup-empty-orders-2026-10*.sql.
-- Copia ridotta dello schema live di orders (stesse colonne, stesso ordine, stessi trigger
-- rilevanti) letta da prod in sola lettura il 22/10. Dati: i 16 ordini vuoti con id, stato,
-- totale, tipo, created_at e codice reali; nomi/telefoni/indirizzi SINTETICI. Più 21 ordini
-- normali con 2 righe ciascuno (37 ordini, 42 righe come su prod).
CREATE TYPE order_status AS ENUM ('pending','accepted','preparing','ready','delivered','cancelled','rejected');
CREATE TYPE fiscal_status AS ENUM ('pending','success','error');

CREATE TABLE public.companies (id uuid PRIMARY KEY, name text);
INSERT INTO public.companies VALUES ('00000000-0000-0000-0000-000000000001', 'Ambrosia');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  status order_status NOT NULL DEFAULT 'pending',
  total_amount numeric(10,2) NOT NULL,  -- come su prod
  fiscal_status fiscal_status NOT NULL DEFAULT 'pending',
  fiscal_external_id text,
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  table_number text,
  order_type text DEFAULT 'eat_in',
  customer_name text,
  customer_phone text,
  delivery_address text,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  decline_reason_preset text,
  decline_reason_note text,
  declined_at timestamptz,
  display_code text,
  accepted_at timestamptz,
  accepted_by uuid
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  notes text
);
CREATE TABLE public.fiscal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  event text
);
CREATE TABLE public.fiscal_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE
);
CREATE TABLE public.order_no_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  note text
);

-- Dati: caricati prima dei trigger (come la storia di prod).
INSERT INTO public.orders (id, customer_id, status, total_amount, created_at, updated_at, order_type,
                           customer_name, customer_phone, display_code, company_id)
SELECT v.id::uuid, v.customer_id::uuid, v.status::order_status, v.total, v.created_at::timestamptz,
       v.updated_at::timestamptz, v.order_type, v.customer_name, v.customer_phone, v.display_code,
       '00000000-0000-0000-0000-000000000001'
FROM (VALUES
  ('d7c6ef59-9d66-43ab-9860-f67b79f8fdbc', '324d9743-d0d8-4451-95dd-8357384f3d4b', 'cancelled', 850.00, '2026-06-12T18:48:42.667864+00', '2026-06-12T18:48:42.667864+00', 'eat_in', 'Cliente prova 1', NULL, NULL),
  ('0d8630d9-0aa1-421f-837a-4a51ddbc70da', NULL, 'cancelled', 14.00, '2026-07-15T10:00:46.580715+00', '2026-07-15T10:00:46.580715+00', 'take_away', 'Cliente prova 2', NULL, NULL),
  ('aaa97d25-ac70-4429-8ec8-6e6503aca940', NULL, 'delivered', 10.50, '2026-07-19T18:12:22.219139+00', '2026-07-19T18:12:22.219139+00', 'eat_in', 'Cliente prova 3', NULL, NULL),
  ('dab829b7-64ca-4f68-a800-d0fbccd4a6a1', NULL, 'delivered', 10.50, '2026-07-19T18:16:03.740214+00', '2026-07-19T18:16:03.740214+00', 'eat_in', 'Cliente prova 4', NULL, NULL),
  ('d8a58667-3882-41b6-bbfb-efb7e4e37a97', NULL, 'delivered', 10.50, '2026-07-19T18:24:40.499953+00', '2026-07-19T18:24:40.499953+00', 'eat_in', 'Cliente prova 5', NULL, NULL),
  ('009bd01a-eeff-4f2c-8589-ccb71c3fd1f6', NULL, 'delivered', 13.50, '2026-09-01T13:48:27.121597+00', '2026-09-01T13:48:27.121597+00', 'take_away', 'Cliente prova 6', NULL, NULL),
  ('9d11aabe-b8dc-421d-b41e-078f74406f4d', NULL, 'delivered', 13.50, '2026-09-01T13:48:31.270681+00', '2026-09-01T13:48:31.270681+00', 'take_away', 'Cliente prova 7', NULL, NULL),
  ('badeb3fc-896b-472f-8e0c-003f0af9c6a3', NULL, 'cancelled', 10.50, '2026-09-01T17:22:25.875612+00', '2026-09-01T17:22:25.875612+00', 'delivery', 'Cliente prova 8', NULL, NULL),
  ('f576eafc-d91e-4a62-bb40-115d05587a49', NULL, 'cancelled', 8.50, '2026-09-01T20:31:39.467194+00', '2026-09-01T20:31:39.467194+00', 'take_away', 'Cliente prova 9', NULL, NULL),
  ('7d3e2aba-a827-4d28-af73-4e1b673551e4', NULL, 'cancelled', 8.50, '2026-09-01T21:43:32.955391+00', '2026-09-01T21:43:32.955391+00', 'eat_in', 'Cliente prova 10', NULL, NULL),
  ('6ef5c377-b337-4c22-af1d-6375fb2c74da', NULL, 'cancelled', 4.50, '2026-09-01T22:26:21.782643+00', '2026-09-01T22:26:21.782643+00', 'eat_in', 'Cliente prova 11', NULL, 'Speck #1'),
  ('42d385a5-c093-420b-8474-392d3f0cb8af', NULL, 'cancelled', 4.50, '2026-09-01T22:36:16.148981+00', '2026-09-01T22:36:16.148981+00', 'eat_in', 'Cliente prova 12', NULL, 'Carbonara #2'),
  ('0d050c47-a5f1-456c-9aec-8e2b7ca9ced2', NULL, 'delivered', 21.50, '2026-09-04T11:01:48.661432+00', '2026-09-04T11:01:48.661432+00', 'eat_in', 'Cliente prova 13', NULL, 'Patate #3'),
  ('df6129d5-bba1-4133-87c8-6c0e4097522e', NULL, 'delivered', 22.00, '2026-09-19T11:31:22.391913+00', '2026-09-19T11:31:22.391913+00', 'take_away', 'Cliente prova 14', NULL, 'Norma #2'),
  ('647a7ff6-a669-4dc5-916c-29b392aec653', NULL, 'cancelled', 26.00, '2026-09-25T20:24:43.901297+00', '2026-09-25T20:24:43.901297+00', 'take_away', 'Cliente prova 15', NULL, 'Marinara #1'),
  ('a1af41ad-53f6-49f6-ab3b-cd3c884514ff', NULL, 'cancelled', 33.00, '2026-09-25T21:02:59.410363+00', '2026-09-25T21:02:59.410363+00', 'eat_in', 'Cliente prova 16', NULL, 'Gamberi #2')
) AS v(id, customer_id, status, total, created_at, updated_at, order_type, customer_name, customer_phone, display_code);

INSERT INTO public.orders (status, total_amount, created_at, order_type, company_id, display_code)
SELECT 'delivered', 10 + g, timestamptz '2026-10-01 18:00+00' + g * interval '1 hour', 'take_away',
       '00000000-0000-0000-0000-000000000001', 'Ordine #' || g
FROM generate_series(1, 21) AS g;
INSERT INTO public.order_items (order_id, quantity, unit_price)
SELECT o.id, 1, 5 FROM public.orders o CROSS JOIN generate_series(1, 2)
WHERE o.display_code LIKE 'Ordine #%';

-- Trigger come su prod (versioni ridotte): un insert diretto non pending fallisce e il codice
-- ordine viene riassegnato. Il ripristino deve aggirarli senza lasciarli spenti.
CREATE FUNCTION public.enforce_order_manual_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status::text <> 'pending' THEN
    RAISE EXCEPTION 'New orders must start as pending (got %)', NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enforce_order_manual_approval BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_manual_approval();
CREATE FUNCTION public.orders_set_display_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.display_code := 'NUOVO #' || (SELECT count(*) + 1 FROM public.orders);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_orders_display_code BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_set_display_code();
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT (SELECT count(*) FROM public.orders) AS orders, (SELECT count(*) FROM public.order_items) AS items;
