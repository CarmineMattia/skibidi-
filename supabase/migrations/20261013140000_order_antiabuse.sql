-- Antiabuso ordini (Skibidi v1). SOLO file di migration: NON applicato al DB live.
-- Dipende da 20261008_atomic_order_submission.sql (ridefinisce create_order_with_items).
-- Da applicare SOLO insieme/dopo il login solo Google (PR #17): da qui in poi gli ospiti non possono ordinare.
--
-- Cosa aggiunge:
--  * companies: limiti configurabili per pizzeria (valore max ordine, ordini aperti, rate limit, soglia mancati ritiri, Turnstile).
--  * customer_restrictions: blocco e contatore mancati ritiri PER PIZZERIA (un admin non tocca altre pizzerie;
--    profiles non viene modificato).
--  * order_no_shows: storico dei "non ritirato" segnati dall'admin; blocco automatico alla soglia della pizzeria.
--  * order_captcha_passes: pass Turnstile monouso scritti dall'edge function verify-turnstile (service role).
--  * create_order_with_items: login obbligatorio + assert_order_antiabuse prima dell'insert.
BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS max_order_total numeric(10,2) NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS max_open_orders_per_user integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS order_rate_limit_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS order_rate_limit_window interval NOT NULL DEFAULT interval '10 minutes',
  ADD COLUMN IF NOT EXISTS no_show_block_threshold integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS require_turnstile boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON public.orders (customer_id, created_at DESC);

-- Blocco e mancati ritiri per (pizzeria, cliente). Scrivono solo le RPC admin qui sotto (SECURITY DEFINER).
CREATE TABLE IF NOT EXISTS public.customer_restrictions (
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  blocked_at timestamptz,
  no_show_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, customer_id)
);
ALTER TABLE public.customer_restrictions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_restrictions FROM anon, authenticated;
GRANT SELECT ON public.customer_restrictions TO authenticated;
DROP POLICY IF EXISTS customer_restrictions_staff_read ON public.customer_restrictions;
CREATE POLICY customer_restrictions_staff_read ON public.customer_restrictions FOR SELECT TO authenticated
  USING (coalesce(public.is_admin(), false) AND company_id = public.get_my_company_id());

CREATE TABLE IF NOT EXISTS public.order_no_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  company_id uuid NOT NULL,
  marked_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_no_shows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_no_shows_staff_read ON public.order_no_shows;
CREATE POLICY order_no_shows_staff_read ON public.order_no_shows FOR SELECT TO authenticated
  USING (public.is_admin() AND company_id = public.get_my_company_id());
GRANT SELECT ON public.order_no_shows TO authenticated;

CREATE TABLE IF NOT EXISTS public.order_captcha_passes (
  user_id uuid PRIMARY KEY,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
-- Nessuna policy: scrive solo l'edge function (service role), legge solo assert_order_antiabuse.
ALTER TABLE public.order_captcha_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_captcha_passes FROM anon, authenticated;

-- Controlli antiabuso per l'utente della sessione. SECURITY DEFINER: deve contare anche
-- ordini che l'RLS del cliente non mostrerebbe. Lock per utente contro invii paralleli.
CREATE OR REPLACE FUNCTION public.assert_order_antiabuse(p_company uuid, p_total numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  c record;
  v_open integer;
  v_recent integer;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'ANTIABUSE_LOGIN_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('order-antiabuse:' || v_uid::text, 0));

  IF EXISTS (SELECT 1 FROM public.customer_restrictions
             WHERE company_id = p_company AND customer_id = v_uid AND blocked) THEN
    RAISE EXCEPTION 'ANTIABUSE_ACCOUNT_BLOCKED';
  END IF;

  SELECT max_order_total, max_open_orders_per_user, order_rate_limit_count,
         order_rate_limit_window, require_turnstile
    INTO c FROM public.companies WHERE id = p_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;

  IF p_total IS NULL OR p_total > c.max_order_total THEN
    RAISE EXCEPTION 'ANTIABUSE_ORDER_TOO_LARGE';
  END IF;

  SELECT count(*) INTO v_open FROM public.orders
   WHERE customer_id = v_uid
     AND status::text IN ('pending', 'accepted', 'preparing', 'ready');
  IF v_open >= c.max_open_orders_per_user THEN
    RAISE EXCEPTION 'ANTIABUSE_TOO_MANY_OPEN_ORDERS';
  END IF;

  SELECT count(*) INTO v_recent FROM public.orders
   WHERE customer_id = v_uid AND created_at > now() - c.order_rate_limit_window;
  IF v_recent >= c.order_rate_limit_count THEN
    RAISE EXCEPTION 'ANTIABUSE_RATE_LIMITED';
  END IF;

  IF c.require_turnstile THEN
    DELETE FROM public.order_captcha_passes
     WHERE user_id = v_uid AND expires_at > now();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ANTIABUSE_CAPTCHA_REQUIRED';
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_order_antiabuse(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_order_antiabuse(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_order_antiabuse(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_order->>'id')::uuid;
  v_company uuid := (p_order->>'company_id')::uuid;
  v_customer uuid := nullif(p_order->>'customer_id', '')::uuid;
  v_existing jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_subtotal numeric;
BEGIN
  IF v_id IS NULL OR v_company IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid order';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 100 lines';
  END IF;
  -- Antiabuso: niente ordini da ospite / sessione anonima.
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'ANTIABUSE_LOGIN_REQUIRED';
  END IF;
  IF v_customer IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order customer does not match the current session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company AND active) THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric)
    LEFT JOIN public.products p ON p.id = i.product_id AND p.company_id = v_company AND p.active
    WHERE p.id IS NULL OR i.quantity IS NULL OR i.quantity NOT BETWEEN 1 AND 1000
      OR i.unit_price IS NULL OR i.unit_price < 0 OR i.total_price IS NULL
      OR round(i.total_price, 2) <> round(i.unit_price * i.quantity, 2)
  ) THEN
    RAISE EXCEPTION 'Invalid order lines';
  END IF;
  SELECT sum(i.total_price) INTO v_subtotal
  FROM jsonb_to_recordset(p_items) AS i(total_price numeric);
  IF (p_order->>'total_amount') IS NULL OR (p_order->>'total_amount')::numeric < v_subtotal THEN
    RAISE EXCEPTION 'Invalid order total';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  v_existing := public.get_order_tracking(v_id);
  IF v_existing IS NOT NULL THEN
    IF (v_existing->>'company_id')::uuid IS DISTINCT FROM v_company
       OR nullif(v_existing->>'customer_id', '')::uuid IS DISTINCT FROM v_customer
       OR (v_existing->>'total_amount')::numeric IS DISTINCT FROM (p_order->>'total_amount')::numeric
       OR v_existing->>'order_type' IS DISTINCT FROM p_order->>'order_type'
       OR v_existing->>'notes' IS DISTINCT FROM p_order->>'notes'
       OR v_existing->>'delivery_address' IS DISTINCT FROM p_order->>'delivery_address'
       OR v_existing->>'table_number' IS DISTINCT FROM p_order->>'table_number'
       OR v_existing->>'customer_name' IS DISTINCT FROM p_order->>'customer_name'
       OR v_existing->>'customer_phone' IS DISTINCT FROM p_order->>'customer_phone' THEN
      RAISE EXCEPTION 'Retry does not match the saved order';
    END IF;
    SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity, i.unit_price, i.total_price, i.notes) ORDER BY i.product_id, i.quantity, i.unit_price, i.notes)
      INTO v_expected FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);
    SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity, i.unit_price, i.total_price, i.notes) ORDER BY i.product_id, i.quantity, i.unit_price, i.notes)
      INTO v_actual FROM jsonb_to_recordset(v_existing->'order_items') AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);
    IF v_expected IS DISTINCT FROM v_actual THEN
      RAISE EXCEPTION 'Retry does not match the saved order lines';
    END IF;
    RETURN jsonb_build_object('id', v_id, 'display_code', v_existing->>'display_code', 'total_amount', v_existing->'total_amount');
  END IF;

  -- Antiabuso lato server (solo per ordini nuovi: i retry idempotenti passano sopra).
  PERFORM public.assert_order_antiabuse(v_company, (p_order->>'total_amount')::numeric);

  INSERT INTO public.orders (id, company_id, customer_id, display_code, status, fiscal_status,
    total_amount, notes, order_type, customer_name, customer_phone, delivery_address, table_number)
  VALUES (v_id, v_company, v_customer, p_order->>'display_code', 'pending', 'pending',
    (p_order->>'total_amount')::numeric, p_order->>'notes', p_order->>'order_type',
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'delivery_address', p_order->>'table_number');

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, notes)
  SELECT v_id, i.product_id, i.quantity, i.unit_price, i.total_price, i.notes
  FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);

  v_existing := public.get_order_tracking(v_id);
  RETURN jsonb_build_object('id', v_id, 'display_code', v_existing->>'display_code', 'total_amount', v_existing->'total_amount');
END;
$$;
REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;

-- Admin: segna "non ritirato". Storico + contatore; blocco automatico alla soglia della pizzeria.
CREATE OR REPLACE FUNCTION public.mark_order_no_show(p_order_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o record;
  v_count integer;
  v_threshold integer;
  v_blocked boolean := false;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Only an admin can mark a no-show';
  END IF;
  SELECT id, company_id, customer_id INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR o.company_id IS DISTINCT FROM public.get_my_company_id() THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF o.customer_id IS NULL THEN
    RAISE EXCEPTION 'Order has no customer account';
  END IF;

  INSERT INTO public.order_no_shows (order_id, customer_id, company_id, marked_by, note)
  VALUES (o.id, o.customer_id, o.company_id, auth.uid(), p_note)
  ON CONFLICT (order_id) DO NOTHING;

  -- Conteggio e soglia della stessa pizzeria.
  SELECT count(*) INTO v_count FROM public.order_no_shows
   WHERE customer_id = o.customer_id AND company_id = o.company_id;
  SELECT no_show_block_threshold INTO v_threshold FROM public.companies WHERE id = o.company_id;

  INSERT INTO public.customer_restrictions AS r (company_id, customer_id, no_show_count, blocked, blocked_reason, blocked_at)
  VALUES (o.company_id, o.customer_id, v_count,
          v_threshold > 0 AND v_count >= v_threshold,
          CASE WHEN v_threshold > 0 AND v_count >= v_threshold THEN 'no_show' END,
          CASE WHEN v_threshold > 0 AND v_count >= v_threshold THEN now() END)
  ON CONFLICT (company_id, customer_id) DO UPDATE SET
    no_show_count = EXCLUDED.no_show_count,
    blocked = r.blocked OR EXCLUDED.blocked,
    blocked_reason = CASE WHEN NOT r.blocked AND EXCLUDED.blocked THEN 'no_show' ELSE r.blocked_reason END,
    blocked_at = CASE WHEN NOT r.blocked AND EXCLUDED.blocked THEN now() ELSE r.blocked_at END,
    updated_at = now()
  RETURNING blocked INTO v_blocked;

  RETURN jsonb_build_object('customer_id', o.customer_id, 'no_show_count', v_count, 'blocked', coalesce(v_blocked, false));
END;
$$;
REVOKE ALL ON FUNCTION public.mark_order_no_show(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_no_show(uuid, text) TO authenticated;

-- Admin: blocca/sblocca un cliente SOLO nella propria pizzeria e solo se ci ha già ordinato.
CREATE OR REPLACE FUNCTION public.set_customer_blocked(p_customer_id uuid, p_blocked boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.get_my_company_id();
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Only an admin can block customers';
  END IF;
  IF v_company IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.orders WHERE customer_id = p_customer_id AND company_id = v_company
  ) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  INSERT INTO public.customer_restrictions AS r (company_id, customer_id, blocked, blocked_reason, blocked_at)
  VALUES (v_company, p_customer_id, p_blocked,
          CASE WHEN p_blocked THEN coalesce(p_reason, 'manual') END,
          CASE WHEN p_blocked THEN now() END)
  ON CONFLICT (company_id, customer_id) DO UPDATE SET
    blocked = EXCLUDED.blocked,
    blocked_reason = EXCLUDED.blocked_reason,
    blocked_at = EXCLUDED.blocked_at,
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_customer_blocked(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_blocked(uuid, boolean, text) TO authenticated;

COMMIT;
