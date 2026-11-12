-- Fixture for 20261111234500_security_hardening.sql. Disposable PGlite only.
-- Starts from the pre-fix shape: broad table grants, get_order_tracking returns
-- the whole order to anyone who can execute it, handle_new_user trusts metadata.
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
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TYPE public.user_role AS ENUM ('admin', 'customer', 'kiosk');
CREATE TABLE public.companies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'customer',
  email text,
  full_name text,
  phone text,
  address text,
  company_id uuid REFERENCES public.companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  name text,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  company_id uuid,
  customer_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  display_code text,
  order_type text,
  table_number text,
  decline_reason_preset text,
  decline_reason_note text,
  declined_at timestamptz,
  customer_name text,
  customer_phone text,
  delivery_address text,
  notes text,
  total_amount numeric
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  product_id uuid,
  quantity integer,
  unit_price numeric,
  total_price numeric,
  notes text
);
CREATE TABLE public.order_daily_counters (
  company_id uuid NOT NULL,
  day date NOT NULL DEFAULT current_date,
  counter integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, day)
);
CREATE TABLE public.internal_probe (id integer PRIMARY KEY);
CREATE TABLE public.staff_read_only (id integer PRIMARY KEY);

CREATE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;
CREATE FUNCTION public.get_my_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE FUNCTION public.default_customer_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(c.id))[1] END
  FROM public.companies c WHERE c.active
$$;

CREATE FUNCTION public.profiles_assign_default_company() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM 'customer'::public.user_role
     AND (NEW.company_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id AND c.active)) THEN
    NEW.company_id := coalesce(public.default_customer_company_id(), NEW.company_id);
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.prevent_profile_privilege_escalation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'customer'::public.user_role THEN
      RAISE EXCEPTION 'Cannot self-assign role %', NEW.role;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Only an admin can change role or company_id';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Pre-fix signup: trusts metadata. The migration must replace this.
CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer'),
    (NEW.raw_user_meta_data->>'company_id')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    company_id = COALESCE(EXCLUDED.company_id, public.profiles.company_id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_profiles_assign_default_company
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_default_company();
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Pre-fix tracking: the whole row, executable by anon.
CREATE FUNCTION public.get_order_tracking(p_order_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(o.*) FROM public.orders o WHERE o.id = p_order_id
$$;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO anon, authenticated;

CREATE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.get_order_tracking((p_order->>'id')::uuid);
END $$;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_read_only ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY products_select ON public.products FOR SELECT USING (true);
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND company_id = public.get_my_company_id());
CREATE POLICY orders_select ON public.orders FOR SELECT
  USING (auth.uid() = customer_id OR (public.is_admin() AND company_id = public.get_my_company_id()));
-- Leftover from the early RLS script: applies to PUBLIC, so anon still matches it
-- until 20261112003000 pins every orders policy to authenticated.
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT
  USING (customer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
  ));
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE
  USING (
    customer_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
    )
  );
CREATE POLICY "Users can view order items" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.customer_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
          )
        )
    )
  );
CREATE POLICY staff_read_only_select ON public.staff_read_only FOR SELECT TO authenticated USING (true);

INSERT INTO public.companies (id, name, active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ambrosia', true),
  ('00000000-0000-0000-0000-000000000002', 'Altra', true);
INSERT INTO public.products (id, company_id, name) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Margherita');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'mario@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'luigi@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'kiosk@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'kiosk2@example.test');
UPDATE public.profiles SET role = 'customer', company_id = '00000000-0000-0000-0000-000000000001', full_name = 'Mario'
  WHERE id = '00000000-0000-0000-0000-0000000000c1';
UPDATE public.profiles SET role = 'customer', company_id = '00000000-0000-0000-0000-000000000001', full_name = 'Luigi'
  WHERE id = '00000000-0000-0000-0000-0000000000c2';
UPDATE public.profiles SET role = 'admin', company_id = '00000000-0000-0000-0000-000000000001', full_name = 'Admin'
  WHERE id = '00000000-0000-0000-0000-0000000000a1';
UPDATE public.profiles SET role = 'kiosk', company_id = '00000000-0000-0000-0000-000000000001', full_name = 'Cassa'
  WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE public.profiles SET role = 'kiosk', company_id = '00000000-0000-0000-0000-000000000002', full_name = 'Altra cassa'
  WHERE id = '00000000-0000-0000-0000-0000000000b2';

INSERT INTO public.orders (
  id, company_id, customer_id, status, display_code, order_type, table_number,
  customer_name, customer_phone, delivery_address, notes, decline_reason_preset, total_amount
) VALUES (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000c1',
  'pending', 'Ordine #4', 'take_away', 'B2',
  'Mario Rossi', '+39 333 0000000', 'Via Roma 1', 'citofono Rossi', 'forno pieno', 12
);

-- Minimal storage catalog so the products policies can be created and checked.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO storage.objects (bucket_id, name) VALUES ('products', 'legacy-flat.jpg');

-- Hosted-style grants: client roles can touch every table, including ones RLS
-- has no policy for. The migration must take those back.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.order_daily_counters, public.internal_probe TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

CREATE FUNCTION public.t_as(p_role text, p_sub uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)::text
         ELSE jsonb_build_object('role', p_role, 'sub', p_sub, 'is_anonymous', false)::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;
CREATE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAILED: %', p_msg; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.t_as(text, uuid), public.t_assert(boolean, text) TO anon, authenticated;
SELECT 'security-hardening fixture ready' AS status;
