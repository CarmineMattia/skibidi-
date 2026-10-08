-- Run only against a disposable local PostgreSQL database.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.staff', true) = 'true' $$;
CREATE FUNCTION public.get_my_company_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.company_id', true), '')::uuid $$;
CREATE TABLE public.companies(id uuid PRIMARY KEY, active boolean);
CREATE TABLE public.products(id uuid PRIMARY KEY, company_id uuid, active boolean, price numeric);
CREATE TABLE public.orders(id uuid PRIMARY KEY, company_id uuid, customer_id uuid, display_code text,
 created_at timestamptz DEFAULT now(), status text, fiscal_status text, total_amount numeric, notes text, order_type text,
 customer_name text, customer_phone text, delivery_address text, table_number text);
CREATE TABLE public.order_items(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, order_id uuid REFERENCES orders(id),
 product_id uuid REFERENCES products(id), quantity integer, unit_price numeric, total_price numeric,
 notes text CHECK(notes IS DISTINCT FROM 'force failure'));
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_insert ON public.orders FOR INSERT WITH CHECK (
 (customer_id IS NULL OR customer_id = auth.uid()) AND status = 'pending' AND fiscal_status = 'pending');
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT ON companies, products TO anon, authenticated;
GRANT SELECT, INSERT ON orders, order_items TO anon, authenticated;
-- Model tenant-scoped staff access only in this disposable fixture.
-- Hosted staff profiles and policies still require a separate live check.
GRANT UPDATE ON orders TO authenticated;
CREATE POLICY staff_orders_read ON orders FOR SELECT TO authenticated
 USING (public.is_admin() AND company_id = public.get_my_company_id());
CREATE POLICY staff_orders_update ON orders FOR UPDATE TO authenticated
 USING (public.is_admin() AND company_id = public.get_my_company_id())
 WITH CHECK (public.is_admin() AND company_id = public.get_my_company_id());
CREATE POLICY staff_items_read ON order_items FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id));
INSERT INTO companies VALUES ('00000000-0000-0000-0000-000000000001', true);
INSERT INTO products VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',true,5);
