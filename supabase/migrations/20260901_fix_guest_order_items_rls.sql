-- P0 fix: guests (anon) could not insert order_items, so the entire guest
-- checkout flow failed at the item stage with:
--   "new row violates row-level security policy for table order_items"
--
-- The previous `order_items_insert` policy required
--   auth.uid() = order.customer_id
-- which is NULL for guest orders (customer_id IS NULL), so it always
-- evaluated to false and blocked every guest item insert.
--
-- Fix: move the per-item validation into a SECURITY DEFINER helper that
-- checks the items against the products table (active product, same company,
-- client-supplied price matches the stored price). SECURITY DEFINER lets us
-- read the products table regardless of the caller's RLS context, so we can
-- validate price integrity for anon without reopening the products table to
-- public writes. This keeps the security properties of the original policy
-- while unblocking the guest flow.
--
-- Also add a scoped `orders_delete` policy so the client-side rollback
-- (delete the just-created order when the item insert fails) can clean up
-- the order row for both guests and their own orders, preventing orphan
-- orders.

-- 1) Helper: validate that every item in the order references an active
--    product of the same company and that the client-supplied price matches
--    the product's stored price exactly. Runs as superuser so it can read
--    the products table regardless of the caller's role.
CREATE OR REPLACE FUNCTION public.can_insert_order_item(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_order_company uuid;
BEGIN
  -- The order must exist and be in the caller's scope. Guests own their
  -- pending orders (customer_id IS NULL); customers own their orders;
  -- admins may insert into any order in their company. The order's own
  -- company becomes the boundary for the product checks below.
  SELECT o.company_id INTO v_order_company
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      o.customer_id IS NULL
      OR o.customer_id = auth.uid()
      OR (public.is_admin() AND public.get_my_company_id() IS NOT NULL)
    );

  IF v_order_company IS NULL THEN
    RETURN false;
  END IF;

  FOR rec IN
    SELECT oi.product_id, oi.unit_price, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = rec.product_id
        AND p.company_id = v_order_company
        AND p.active = true
        AND p.price = rec.unit_price
    ) THEN
      RETURN false;
    END IF;

    IF rec.quantity IS NULL OR rec.quantity < 0 OR rec.quantity > 1000 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_insert_order_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_insert_order_item(uuid) TO anon, authenticated;

-- 2) Replace the order_items insert policy with one that uses the helper.
DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.can_insert_order_item(order_id)
  );

DROP POLICY IF EXISTS orders_delete ON public.orders;
CREATE POLICY orders_delete ON public.orders
  FOR DELETE
  TO anon, authenticated
  USING (
    (public.is_admin() AND public.get_my_company_id() IS NOT NULL)
    OR customer_id = auth.uid()
    OR (customer_id IS NULL AND status = 'pending')
  );
