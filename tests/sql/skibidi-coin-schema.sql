-- Fixture locale (PGlite) per Skibidi Coin. Nessun database ospitato.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

CREATE TYPE public.user_role AS ENUM ('admin', 'customer', 'kiosk');
CREATE TABLE public.companies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role public.user_role NOT NULL DEFAULT 'customer',
  email text,
  full_name text,
  company_id uuid REFERENCES public.companies(id)
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  customer_id uuid,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  order_type text,
  customer_name text,
  customer_phone text,
  delivery_address text,
  table_number text,
  display_code text,
  accepted_at timestamptz,
  accepted_by uuid,
  decline_reason_preset text,
  decline_reason_note text,
  declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  product_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0
);

CREATE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION public.get_my_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE FUNCTION public.is_valid_order_transition(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_from = p_to OR (p_from, p_to) IN (
    ('pending','accepted'), ('pending','rejected'), ('pending','cancelled'),
    ('accepted','preparing'), ('accepted','cancelled'),
    ('preparing','ready'), ('preparing','cancelled'),
    ('ready','delivered'), ('ready','cancelled'));
$$;

CREATE FUNCTION public.enforce_order_manual_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text <> 'pending' THEN
      RAISE EXCEPTION 'New orders must start as pending (got %)', NEW.status;
    END IF;
    NEW.accepted_at := NULL; NEW.accepted_by := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status::text = OLD.status::text THEN
    NEW.accepted_at := OLD.accepted_at; NEW.accepted_by := OLD.accepted_by;
    RETURN NEW;
  END IF;
  IF NOT public.is_valid_order_transition(OLD.status::text, NEW.status::text) THEN
    RAISE EXCEPTION 'Invalid order status transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status::text IN ('accepted','rejected') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can accept or reject an order';
  END IF;
  IF NEW.status::text = 'accepted' THEN
    NEW.accepted_at := now(); NEW.accepted_by := auth.uid();
  ELSE
    NEW.accepted_at := OLD.accepted_at; NEW.accepted_by := OLD.accepted_by;
  END IF;
  IF NEW.status::text = 'preparing' AND OLD.accepted_at IS NULL THEN
    RAISE EXCEPTION 'Order must be accepted by an admin before preparation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_order_manual_approval
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_manual_approval();

CREATE FUNCTION public.prevent_customer_order_tampering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION 'Only an admin can change order status, ownership, or total'
      USING DETAIL = 'ORDER_LOCKED_FOR_CUSTOMER';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_prevent_customer_order_tampering
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_order_tampering();

GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items, public.profiles, public.companies TO authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR (public.is_admin() AND company_id = public.get_my_company_id()));
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin() AND company_id = public.get_my_company_id())
  WITH CHECK (public.is_admin() AND company_id = public.get_my_company_id());

INSERT INTO public.companies (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Pizzeria Ambrosia'),
  ('00000000-0000-0000-0000-000000000002', 'Altra');
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin-a@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin-b@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'anna@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'bruno@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'kiosk@example.test');
INSERT INTO public.profiles (id, role, email, full_name, company_id) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'admin-a@example.test', 'Admin Ambrosia', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin', 'admin-b@example.test', 'Admin Altra', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000c1', 'customer', 'anna@example.test', 'Anna Rossi', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000c2', 'customer', 'bruno@example.test', 'Bruno Verdi', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000d1', 'kiosk', 'kiosk@example.test', 'Cassa', '00000000-0000-0000-0000-000000000001');

-- Forma ristretta di get_order_tracking (20261111234500), senza i campi punti:
-- la migration successiva li aggiunge e non deve rimettere i dati del cliente.
CREATE FUNCTION public.get_order_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'accepted_at', o.accepted_at,
    'display_code', o.display_code,
    'order_type', o.order_type,
    'table_number', o.table_number,
    'decline_reason_preset', o.decline_reason_preset,
    'decline_reason_note', o.decline_reason_note,
    'declined_at', o.declined_at
  )
  INTO v
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      o.customer_id = auth.uid()
      OR (
        coalesce(public.is_admin(), false)
        AND o.company_id IS NOT DISTINCT FROM public.get_my_company_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'kiosk'::public.user_role
          AND p.company_id IS NOT DISTINCT FROM o.company_id
      )
    );
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO authenticated;

-- Stub con gli stessi frammenti di create_order_with_items (20261022100000),
-- così la migration può collegare la richiesta punti e il test lo verifica.
CREATE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_id uuid := (p_order->>'id')::uuid;
  v_company uuid := (p_order->>'company_id')::uuid;
  v_customer uuid := nullif(p_order->>'customer_id', '')::uuid;
  v_existing jsonb;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_display_code text;
  v_order_notes text := p_order->>'notes';
  v_items jsonb;
BEGIN
  IF (v_existing->>'company_id')::uuid IS DISTINCT FROM v_company
     OR nullif(v_existing->>'customer_id', '')::uuid IS DISTINCT FROM v_customer
     OR v_existing->>'order_type' IS DISTINCT FROM p_order->>'order_type'
     OR (v_existing->>'notes' IS DISTINCT FROM v_order_notes
         AND v_existing->>'notes' IS DISTINCT FROM p_order->>'notes')
     OR v_existing->>'delivery_address' IS DISTINCT FROM p_order->>'delivery_address'
     OR v_existing->>'table_number' IS DISTINCT FROM p_order->>'table_number'
     OR v_existing->>'customer_name' IS DISTINCT FROM p_order->>'customer_name'
     OR v_existing->>'customer_phone' IS DISTINCT FROM p_order->>'customer_phone' THEN
    RAISE EXCEPTION 'Retry does not match the saved order';
  END IF;
  INSERT INTO public.orders (id, company_id, customer_id, display_code, status, fiscal_status,
    total_amount, notes, order_type, customer_name, customer_phone, delivery_address, table_number)
  VALUES (v_id, v_company, v_customer, v_display_code, 'pending', 'pending',
    v_total, v_order_notes, p_order->>'order_type',
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'delivery_address', p_order->>'table_number');
  RETURN '{}'::jsonb;
END;
$fn$;

CREATE FUNCTION public.t_as(p_role text, p_sub uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)
         ELSE jsonb_build_object('role', p_role, 'sub', p_sub, 'is_anonymous', false) END::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;
CREATE FUNCTION public.t_clear() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RESET ROLE;
END $$;
CREATE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAILED: %', p_msg; END IF; END $$;
CREATE FUNCTION public.t_expect_detail(p_sql text, p_needle text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ASSERT FAILED: expected error %, statement succeeded', p_needle;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL, v_message = MESSAGE_TEXT;
    IF v_message LIKE 'ASSERT FAILED:%' THEN
      RAISE;
    END IF;
    IF coalesce(v_detail, '') IS DISTINCT FROM p_needle AND v_message NOT LIKE '%' || p_needle || '%' THEN
      RAISE EXCEPTION 'ASSERT FAILED: expected %, got detail=% message=%', p_needle, v_detail, v_message;
    END IF;
  END;
END $$;
GRANT EXECUTE ON FUNCTION public.t_as(text, uuid), public.t_assert(boolean, text), public.t_expect_detail(text, text)
  TO anon, authenticated;
