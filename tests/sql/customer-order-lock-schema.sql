-- Fixture: the live orders UPDATE / DELETE state (read-only check on prod,
-- 20/10) on top of the order chain fixture. Disposable local DB only.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fiscal_external_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS decline_reason_preset text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS decline_reason_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS declined_at timestamptz;
-- live: order_items.order_id ON DELETE CASCADE
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
-- live: orders_update / orders_delete, grants
DROP POLICY IF EXISTS staff_orders_update ON public.orders;
DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders FOR UPDATE
  USING ((public.is_admin() AND company_id = public.get_my_company_id()) OR (auth.uid() = customer_id));
DROP POLICY IF EXISTS orders_delete ON public.orders;
CREATE POLICY orders_delete ON public.orders FOR DELETE TO anon, authenticated
  USING ((public.is_admin() AND public.get_my_company_id() IS NOT NULL) OR customer_id = auth.uid()
         OR (customer_id IS NULL AND status = 'pending'));
GRANT SELECT, UPDATE, DELETE ON public.orders, public.order_items TO anon, authenticated;
-- live trigger (20260715120000_consolidate_tighten_admin_rls.sql)
CREATE OR REPLACE FUNCTION public.prevent_customer_order_tampering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if public.is_admin() then return new; end if;
  if new.status is distinct from old.status
     or new.decline_reason_preset is distinct from old.decline_reason_preset
     or new.decline_reason_note is distinct from old.decline_reason_note
     or new.declined_at is distinct from old.declined_at
     or new.company_id is distinct from old.company_id
     or new.customer_id is distinct from old.customer_id
     or new.total_amount is distinct from old.total_amount
  then
    raise exception 'Only an admin can change order status, ownership, or total';
  end if;
  return new;
end;
$function$;
DROP TRIGGER IF EXISTS trg_prevent_customer_order_tampering ON public.orders;
CREATE TRIGGER trg_prevent_customer_order_tampering BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_order_tampering();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
-- rows (as owner): c1's take-away 5 € order, a legacy guest order, company 2
CREATE OR REPLACE FUNCTION pg_temp.seed() RETURNS void LANGUAGE sql AS $$
  INSERT INTO companies (id, active) VALUES ('00000000-0000-0000-0000-000000000002', true) ON CONFLICT DO NOTHING;
  INSERT INTO products (id, company_id, active, price) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002',true,7) ON CONFLICT DO NOTHING;
  DELETE FROM order_items WHERE order_id::text LIKE '00000000-0000-0000-0000-0000000001%';
  DELETE FROM orders WHERE id::text LIKE '00000000-0000-0000-0000-0000000001%';
  INSERT INTO orders (id, company_id, customer_id, display_code, status, fiscal_status, total_amount, order_type, notes) VALUES
   ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','Ordine #1','pending','pending',5,'take_away','Pagamento alla cassa'),
   ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001',NULL,'Ordine #2','pending','pending',5,'take_away',NULL),
   ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c3','Altro #1','pending','pending',7,'take_away',NULL);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes) VALUES
   ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011',1,5,5,'[P] Margherita'),
   ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000011',1,5,5,NULL),
   ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000021',1,7,7,NULL);
$$;
-- (rows are created by pg_temp.seed() in the lock tests only, so the other suites see no extra orders)
SELECT 'lock fixture ready' AS status;
