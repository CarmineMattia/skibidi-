-- Fixture: live state of profiles / companies / categories / products / menu_pricing
-- read policies and the signup trigger (read-only check on prod, 20/10).
-- Self-contained; disposable local DB (PGlite) only.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
-- same bodies as live auth.uid() / auth.role(); auth.jwt() as Supabase
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb, is_anonymous boolean DEFAULT false, created_at timestamptz DEFAULT now());

CREATE TYPE public.user_role AS ENUM ('admin', 'customer', 'kiosk');
CREATE TABLE public.companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), role public.user_role DEFAULT 'customer'::public.user_role,
  email text, full_name text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  phone text, address text, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL);
CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0, company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT);
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE, name text NOT NULL, price numeric NOT NULL,
  active boolean NOT NULL DEFAULT true, company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT);
CREATE TABLE public.menu_pricing (company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE, config jsonb NOT NULL);

CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
CREATE FUNCTION public.get_my_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select company_id from public.profiles where id = auth.uid() $$;

-- live handle_new_user + on_auth_user_created
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  insert into public.profiles (id, email, full_name, role, company_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'customer'::public.user_role,
    (new.raw_user_meta_data->>'company_id')::uuid)
  on conflict (id) do update set
    email = excluded.email, full_name = excluded.full_name,
    company_id = coalesce(excluded.company_id, profiles.company_id);
  return new;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- live prevent_profile_privilege_escalation
CREATE FUNCTION public.prevent_profile_privilege_escalation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.role is distinct from 'customer'::public.user_role then
      raise exception 'Cannot self-assign role %', new.role;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
      raise exception 'Only an admin can change role or company_id';
    end if;
  end if;
  return new;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- live grants + RLS + policies (names / roles / expressions as on prod)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.companies, public.categories, public.products TO anon, authenticated;
GRANT ALL ON public.profiles, public.companies, public.categories, public.products, public.menu_pricing TO service_role;
GRANT SELECT ON public.menu_pricing TO anon, authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_select ON public.companies FOR SELECT USING (active = true);
CREATE POLICY companies_update ON public.companies FOR UPDATE USING (is_admin() AND (id = get_my_company_id())) WITH CHECK (is_admin() AND (id = get_my_company_id()));
CREATE POLICY categories_select ON public.categories FOR SELECT USING ((auth.uid() IS NULL) OR (company_id = get_my_company_id()));
CREATE POLICY categories_insert ON public.categories FOR INSERT WITH CHECK (is_admin() AND (company_id = get_my_company_id()));
CREATE POLICY categories_update ON public.categories FOR UPDATE USING (is_admin() AND (company_id = get_my_company_id()));
CREATE POLICY categories_delete ON public.categories FOR DELETE USING (is_admin() AND (company_id = get_my_company_id()));
CREATE POLICY products_select ON public.products FOR SELECT USING ((auth.uid() IS NULL) OR (company_id = get_my_company_id()));
CREATE POLICY products_insert ON public.products FOR INSERT WITH CHECK (is_admin() AND (company_id = get_my_company_id()));
CREATE POLICY products_update ON public.products FOR UPDATE USING (is_admin() AND (company_id = get_my_company_id()));
CREATE POLICY products_delete ON public.products FOR DELETE USING (is_admin() AND (company_id = get_my_company_id()));
CREATE POLICY menu_pricing_read ON public.menu_pricing FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING ((auth.uid() = id) OR (is_admin() AND (company_id = get_my_company_id())));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((auth.uid() = id) OR (is_admin() AND (company_id = get_my_company_id())));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE USING (is_admin() AND (company_id = get_my_company_id()));

-- rows (as owner): Ambrosia (active) + a disabled tenant; same profile shapes as live
INSERT INTO public.companies (id, name, slug, active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ambrosia', 'ambrosia', true),
  ('00000000-0000-0000-0000-000000000002', 'Chiusa', 'chiusa', false);
INSERT INTO public.categories (id, name, company_id) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Classiche', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a2', 'Bevande', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000b1', 'Altro', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.products (id, category_id, name, price, active, company_id) VALUES
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', 'Margherita', 5, true, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a2', 'Acqua', 1, true, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1', 'Vecchia', 9, false, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'Altra', 7, true, '00000000-0000-0000-0000-000000000002');
INSERT INTO public.menu_pricing VALUES ('00000000-0000-0000-0000-000000000001', '{"version":1}');
-- seeded staff / demo customer (company set), two self-signups without company (as live, 30/03)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'customer@example.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'kiosk@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'nulla1@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'nulla2@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'kiosk-null@example.test');
UPDATE public.profiles SET company_id = '00000000-0000-0000-0000-000000000001', role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET company_id = '00000000-0000-0000-0000-000000000001' WHERE id = '00000000-0000-0000-0000-0000000000d2';
UPDATE public.profiles SET company_id = '00000000-0000-0000-0000-000000000001', role = 'kiosk' WHERE id = '00000000-0000-0000-0000-0000000000d3';
UPDATE public.profiles SET role = 'kiosk' WHERE id = '00000000-0000-0000-0000-0000000000e3';

-- helpers: act as a JWT (role + sub) inside the current transaction
CREATE FUNCTION public.t_as(p_role text, p_sub uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)
         ELSE jsonb_build_object('role', p_role, 'sub', p_sub, 'is_anonymous', false) END::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;
GRANT EXECUTE ON FUNCTION public.t_as(text, uuid) TO anon, authenticated;
CREATE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAILED: %', p_msg; END IF; END $$;
GRANT EXECUTE ON FUNCTION public.t_assert(boolean, text) TO anon, authenticated;
SELECT 'customer-company-menu fixture ready' AS status,
  (SELECT count(*) FROM public.profiles WHERE company_id IS NULL AND role = 'customer') AS null_customers;
