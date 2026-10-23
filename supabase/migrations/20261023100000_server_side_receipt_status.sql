-- Receipt / fiscal status is server-side only (migration only in the PR;
-- apply to prod only with Carmine's OK).
--
-- Live today (read-only check, 23/10, after 20261020160000_customer_order_update_lock):
--   * trg_prevent_customer_order_tampering lets a non-admin anon/authenticated
--     caller change fiscal_status (pending → success | error), fiscal_external_id
--     and pdf_url on their own order while fiscal_status is 'pending'.
--   * orders_update (authenticated): admin of the company OR auth.uid() = customer_id.
--   So during the pending window a customer can mark their own receipt as
--   'success' (with any receipt id / pdf link) straight from the browser.
--
-- Payment is only at the till: the receipt belongs to staff (admin app / POS)
-- or to a server path (service_role, SECURITY DEFINER), never to the customer.
--
-- After this migration:
--   * a non-admin anon/authenticated UPDATE on orders is refused for every
--     column, receipt columns included (no-op updates and updated_at only are
--     still accepted so nothing breaks on harmless writes);
--   * orders_update: only an admin of the order's company (customers have no
--     legitimate UPDATE left);
--   * admins of the company (FiscalContext / FiscalRetryPanel / admin
--     checkout) and service_role / owner (triggers, SECURITY DEFINER RPCs,
--     future POS / edge function) are unchanged.
-- The app no longer sends a receipt update for customers (lib/hooks/useCreateOrder.ts):
-- their order stays fiscal_status 'pending' until staff fiscalize it at the till.

CREATE OR REPLACE FUNCTION public.prevent_customer_order_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Customers: the order (receipt outcome included) is frozen after creation.
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION 'Only an admin can change order status, ownership, or total'
      USING DETAIL = 'ORDER_LOCKED_FOR_CUSTOMER';
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
  USING (public.is_admin() AND company_id = public.get_my_company_id())
  WITH CHECK (public.is_admin() AND company_id = public.get_my_company_id());
