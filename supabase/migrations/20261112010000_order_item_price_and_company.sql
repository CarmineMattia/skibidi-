-- Follow-up to 20261112003000. File only: not applied to production.
--
-- 1. order_items.quantity must be > 0. The check is added NOT VALID and
--    validated only when every existing row already complies. A row with
--    quantity <= 0 leaves the constraint NOT VALID (new rows are still
--    checked) and this migration logs a notice instead of failing.
-- 2. A direct insert or update by a non-admin client cannot choose the line
--    price or attach a product from another company, or an inactive product.
--    unit_price and total_price are taken from products.price. The checkout
--    RPC is SECURITY DEFINER, so this trigger sees the function owner rather
--    than anon/authenticated and leaves those rows to order_line_priced.
--    Admins are unchanged. A kiosk is not an admin: a direct insert is priced
--    from the catalog. The kitchen does not need that path.
-- 3. create_order_with_items keeps its signature, SECURITY DEFINER,
--    search_path and grants. The company is the caller's profile company
--    (get_my_company_id). When that is null and exactly one company is
--    active, that company is used (on this deployment,
--    00000000-0000-0000-0000-000000000001). A client company_id that differs
--    is refused. Client line prices are still ignored.

-- ---------------------------------------------------------------------------
-- 1. quantity > 0
-- ---------------------------------------------------------------------------

DO $qty$
BEGIN
  IF to_regclass('public.order_items') IS NULL THEN
    RAISE NOTICE '20261112010000: order_items assente, salto il check sulla quantità';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_positive'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0) NOT VALID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.order_items WHERE quantity IS NOT NULL AND quantity <= 0
  ) THEN
    RAISE NOTICE 'order_items_quantity_positive left NOT VALID: some rows have quantity <= 0';
  ELSE
    ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_quantity_positive;
  END IF;
END
$qty$;

-- ---------------------------------------------------------------------------
-- 2. Direct client lines take the catalog price
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_order_item_catalog_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_order_company uuid;
  v_product_company uuid;
  v_active boolean;
  v_price numeric;
BEGIN
  -- Invoker rights on purpose. Inside create_order_with_items (SECURITY
  -- DEFINER) current_user is the function owner, so the priced row is kept.
  -- A PostgREST insert runs as anon or authenticated and is rewritten here.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF coalesce(public.is_admin(), false) THEN
    RETURN NEW;
  END IF;

  SELECT o.company_id INTO v_order_company
  FROM public.orders o
  WHERE o.id = NEW.order_id;
  IF v_order_company IS NULL THEN
    RAISE EXCEPTION 'Invalid order';
  END IF;

  SELECT p.company_id, p.active, p.price
    INTO v_product_company, v_active, v_price
  FROM public.products p
  WHERE p.id = NEW.product_id;
  IF NOT FOUND
     OR v_active IS NOT TRUE
     OR v_product_company IS DISTINCT FROM v_order_company
     OR v_price IS NULL
     OR v_price < 0 THEN
    RAISE EXCEPTION 'Product not available' USING DETAIL = 'ORDER_PRODUCT_UNAVAILABLE';
  END IF;

  NEW.unit_price := v_price;
  NEW.total_price := round(v_price * NEW.quantity, 2);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_order_item_catalog_price() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_order_item_catalog_price ON public.order_items;
CREATE TRIGGER trg_enforce_order_item_catalog_price
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_catalog_price();

-- ---------------------------------------------------------------------------
-- 3. Checkout company comes from the profile, not the client payload
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.default_customer_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(c.id))[1] END
  FROM public.companies c
  WHERE c.active;
$$;
REVOKE ALL ON FUNCTION public.default_customer_company_id() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.order_caller_company(p_client uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company uuid := public.get_my_company_id();
BEGIN
  IF v_company IS NULL THEN
    v_company := public.default_customer_company_id();
  END IF;
  IF v_company IS NULL
     OR (p_client IS NOT NULL AND p_client IS DISTINCT FROM v_company) THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;
  RETURN v_company;
END;
$function$;
REVOKE ALL ON FUNCTION public.order_caller_company(uuid) FROM PUBLIC, anon, authenticated;

DO $company_src$
DECLARE
  src text;
  patched text;
BEGIN
  IF to_regprocedure('public.create_order_with_items(jsonb, jsonb)') IS NULL THEN
    RAISE NOTICE '20261112010000: create_order_with_items assente, company non riallineata';
    RETURN;
  END IF;
  src := pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure);
  IF position('order_caller_company' IN src) > 0 THEN
    RETURN;
  END IF;
  -- Fixtures that stub the RPC (no client company assignment) stay as they are.
  IF position('v_company uuid := (p_order->>''company_id'')::uuid;' IN src) = 0 THEN
    RAISE NOTICE '20261112010000: create_order_with_items senza company dal client, lasciata com''è';
    RETURN;
  END IF;
  patched := replace(
    src,
    'v_company uuid := (p_order->>''company_id'')::uuid;',
    'v_company uuid := public.order_caller_company(nullif(p_order->>''company_id'', '''')::uuid);'
  );
  IF patched = src THEN
    RAISE EXCEPTION 'create_order_with_items: assegnazione di company_id non riconosciuta';
  END IF;
  EXECUTE patched;
END
$company_src$;

DO $checkout_grants$
BEGIN
  IF to_regprocedure('public.create_order_with_items(jsonb, jsonb)') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO service_role;
  END IF;
END
$checkout_grants$;
