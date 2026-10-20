-- Customers cannot change their orders after creation (migration only in the
-- PR; apply to prod only with Carmine's OK).
--
-- Live today (read-only check, 20/10):
--   * orders_update (roles public): USING admin of the company OR customer_id = auth.uid()
--   * trg_prevent_customer_order_tampering only blocks status / decline fields /
--     company_id / customer_id / total_amount. A customer could still change
--     order_type, delivery_address, notes, table_number, customer_name/phone,
--     display_code, … on their own order: e.g. a 5 € take-away turned into a
--     delivery after creation, delivered without the delivery fee (round18 P3).
--   * orders_delete: admin of ANY company (no company check), the customer on
--     their own orders (any status), and anyone (anon too) on pending orders
--     with customer_id NULL (leftover of the old client-side rollback).
--   * anon / authenticated keep UPDATE, DELETE grants on orders and order_items
--     (order_items has no UPDATE / DELETE policy, so RLS already denies them).
--
-- What customers legitimately update from the app: only the receipt outcome
-- right after checkout (lib/hooks/useCreateOrder.ts: fiscal_status,
-- fiscal_external_id, pdf_url while fiscal_status is 'pending'). Cancelling is
-- not a customer action (status changes are admin-only already). Customers
-- never delete orders and never touch order_items after creation
-- (create_order_with_items writes them in one transaction).
--
-- After this migration:
--   * a non-admin anon/authenticated UPDATE may change only fiscal_status
--     (pending → success | error), fiscal_external_id and pdf_url, and only
--     while fiscal_status is still 'pending'; any other column → refused
--     (deny by default: new columns are locked too);
--   * orders_update: authenticated only, same USING, explicit WITH CHECK;
--   * orders_delete: only an admin of the order's company;
--   * anon loses UPDATE / DELETE on orders and order_items; authenticated
--     loses UPDATE / DELETE on order_items (no policy allowed them anyway).
-- Admins (is_admin(), scoped to their company by the policies) and
-- service_role / owner (triggers, SECURITY DEFINER RPCs) are unchanged.
-- Independent of 20261020150000_server_side_pricing (that one only inserts).

CREATE OR REPLACE FUNCTION public.prevent_customer_order_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_free constant text[] := ARRAY['fiscal_status', 'fiscal_external_id', 'pdf_url', 'updated_at'];
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Everything except the receipt outcome is frozen for customers.
  IF (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
    RAISE EXCEPTION 'Only an admin can change order status, ownership, or total'
      USING DETAIL = 'ORDER_LOCKED_FOR_CUSTOMER';
  END IF;

  -- Receipt outcome: once, right after checkout.
  IF (to_jsonb(NEW) -> 'fiscal_status', to_jsonb(NEW) -> 'fiscal_external_id', to_jsonb(NEW) -> 'pdf_url')
     IS DISTINCT FROM
     (to_jsonb(OLD) -> 'fiscal_status', to_jsonb(OLD) -> 'fiscal_external_id', to_jsonb(OLD) -> 'pdf_url') THEN
    IF to_jsonb(OLD) ->> 'fiscal_status' IS DISTINCT FROM 'pending'
       OR to_jsonb(NEW) ->> 'fiscal_status' NOT IN ('pending', 'success', 'error') THEN
      RAISE EXCEPTION 'Only an admin can change order status, ownership, or total'
        USING DETAIL = 'ORDER_LOCKED_FOR_CUSTOMER';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_order_tampering() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_customer_order_tampering ON public.orders;
CREATE TRIGGER trg_prevent_customer_order_tampering
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_order_tampering();

DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders
  FOR UPDATE
  TO authenticated
  USING ((public.is_admin() AND company_id = public.get_my_company_id()) OR (auth.uid() = customer_id))
  WITH CHECK ((public.is_admin() AND company_id = public.get_my_company_id()) OR (auth.uid() = customer_id));

DROP POLICY IF EXISTS orders_delete ON public.orders;
CREATE POLICY orders_delete ON public.orders
  FOR DELETE
  TO authenticated
  USING (public.is_admin() AND company_id = public.get_my_company_id());

REVOKE UPDATE, DELETE ON TABLE public.orders FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.order_items FROM anon, authenticated;
