-- Server-side pricing (migration only in the PR; apply to prod only with Carmine's OK).
--
-- create_order_with_items now prices every order on the server and ignores
-- the client's unit_price / total_price / total_amount:
--   * unit price per line from the product list price plus the "structured"
--     listino (sizes, mezzo metro, Componi la tua pizza, added ingredients),
--     read from the same modifier lines the kitchen sees in order_items.notes
--     ("Taglia: …", "+ …", "Gusto N: …", "Impasto: …", "Base: …"), so what is
--     made is what is paid;
--   * delivery fee from companies.settings.deliveryFeeEur (default 2, as the
--     client) for order_type = 'delivery';
--   * order total = Σ lines + fee; rejected below 0.01 €; anti-abuse (max
--     total) runs on the server total.
-- Inactive products, products of another company and unknown sizes / doughs /
-- sauces / added ingredients / mezzo metro gusti are rejected.
--
-- The listino that until now lived only in the client (lib/data/pizzaBuilder.ts,
-- lib/data/ingredients.ts) moves to public.menu_pricing (one row per company,
-- seeded below from those constants; the client reads the same row, see
-- lib/stores/MenuPricingContext.tsx; tests/unit/serverPricingParity.spec.ts
-- checks seed == client constants).
--
-- Unchanged: SECURITY DEFINER + search_path=public, grants (authenticated +
-- service_role), login / session checks, anti-abuse, server display code,
-- idempotent retry (now matched on products / quantities / notes, not on the
-- client prices). Old clients keep working: the payload is the same and the
-- prices they send are ignored.

-- 1) Listino table ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_pricing (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_pricing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menu_pricing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.menu_pricing TO anon, authenticated;
DROP POLICY IF EXISTS menu_pricing_read ON public.menu_pricing;
-- The listino is public (it is the menu): anyone can read it, nobody but the
-- owner / service_role writes it (no write grants, no write policies).
CREATE POLICY menu_pricing_read ON public.menu_pricing FOR SELECT TO anon, authenticated USING (true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.menu_pricing TO service_role;
  END IF;
END $$;

-- Default listino = current client constants (Ambrosia). Do not edit by hand:
-- tests/unit/serverPricingParity.spec.ts compares it with lib/data/menuPricing.ts.
CREATE OR REPLACE FUNCTION public.menu_pricing_default()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT $seed${"version":1,"builderProductName":"Componi la tua pizza","maxMezzoMetroGusti":3,"menuSizes":[{"id":"normale","label":"Normale","priceDelta":0,"priceMultiplier":null,"ingredientMultiplier":1},{"id":"piccola","label":"Piccola","priceDelta":-1,"priceMultiplier":null,"ingredientMultiplier":1},{"id":"tirata","label":"Tirata","priceDelta":0,"priceMultiplier":null,"ingredientMultiplier":1},{"id":"mezzo_metro","label":"Mezzo metro","priceDelta":0,"priceMultiplier":2,"ingredientMultiplier":2}],"defaultMenuSize":"normale","builderSizes":[{"id":"piccola","label":"Piccola","basePrice":4,"ingredientMultiplier":1},{"id":"media","label":"Media","basePrice":5,"ingredientMultiplier":1},{"id":"mezzo_metro","label":"Mezzo metro","basePrice":9,"ingredientMultiplier":2}],"builderDoughs":[{"id":"normale","label":"Normale","surcharge":0},{"id":"doppia_pasta","label":"Doppia pasta","surcharge":2},{"id":"integrale","label":"Integrale","surcharge":1.5},{"id":"gluten_free","label":"Gluten free","surcharge":2}],"builderSauces":[{"id":"pomodoro","label":"Pomodoro","surcharge":0},{"id":"doppio_pomodoro","label":"Doppio pomodoro","surcharge":0.5},{"id":"bianca","label":"Bianca","surcharge":0}],"defaultBuilderSize":"media","ingredientCategoryPrices":{"salse":1,"formaggi":1.5,"salumi":1.5,"verdure":1,"pesce":2,"extra":0.5},"ingredients":[{"name":"Pomodoro","category":"salse"},{"name":"Crema di radicchio","category":"salse"},{"name":"Crema tartufata","category":"salse"},{"name":"Crema di pistacchio","category":"salse"},{"name":"Pesto genovese","category":"salse"},{"name":"Glassa di aceto balsamico","category":"salse"},{"name":"Olio piccante","category":"salse"},{"name":"Mozzarella","category":"formaggi"},{"name":"Mozzarella di bufala","category":"formaggi"},{"name":"Burrata","category":"formaggi"},{"name":"Stracciatella","category":"formaggi"},{"name":"Gorgonzola","category":"formaggi"},{"name":"Scamorza affumicata","category":"formaggi"},{"name":"Parmigiano Reggiano","category":"formaggi"},{"name":"Scaglie di grana","category":"formaggi"},{"name":"Stracchino","category":"formaggi"},{"name":"Prosciutto cotto","category":"salumi"},{"name":"Prosciutto crudo","category":"salumi"},{"name":"Salame piccante","category":"salumi"},{"name":"Salsiccia","category":"salumi"},{"name":"'Nduja","category":"salumi"},{"name":"Speck","category":"salumi"},{"name":"Pancetta","category":"salumi"},{"name":"Bresaola","category":"salumi"},{"name":"Mortadella","category":"salumi"},{"name":"Wurstel","category":"salumi"},{"name":"Basilico","category":"verdure"},{"name":"Pomodorini","category":"verdure"},{"name":"Rucola","category":"verdure"},{"name":"Friarielli","category":"verdure"},{"name":"Melanzane","category":"verdure"},{"name":"Zucchine","category":"verdure"},{"name":"Peperoni","category":"verdure"},{"name":"Radicchio","category":"verdure"},{"name":"Porcini trifolati","category":"verdure"},{"name":"Funghi champignon","category":"verdure"},{"name":"Cipolla","category":"verdure"},{"name":"Olive nere","category":"verdure"},{"name":"Capperi","category":"verdure"},{"name":"Mais","category":"verdure"},{"name":"Patate al forno","category":"verdure"},{"name":"Tonno","category":"pesce"},{"name":"Acciughe","category":"pesce"},{"name":"Gamberetti","category":"pesce"},{"name":"Frutti di mare","category":"pesce"},{"name":"Origano","category":"extra"},{"name":"Aglio","category":"extra"},{"name":"Uova","category":"extra"},{"name":"Noci","category":"extra"},{"name":"Pepe nero","category":"extra"},{"name":"Prezzemolo","category":"extra"}]}$seed$::jsonb;
$fn$;
REVOKE ALL ON FUNCTION public.menu_pricing_default() FROM PUBLIC, anon, authenticated;

INSERT INTO public.menu_pricing (company_id, config)
SELECT c.id, public.menu_pricing_default() FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- 2) Unit price of one order line ---------------------------------------------
-- Mirrors lib/data/menuPricing.ts (computeMenuItemUnitPrice) and
-- lib/data/pizzaBuilder.ts (calculateBuilderPrice). Raises 'Invalid order
-- lines' when the line cannot be priced reliably.
CREATE OR REPLACE FUNCTION public.order_line_unit_price(p_company uuid, p_product uuid, p_notes text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cfg jsonb;
  v_name text;
  v_price numeric;
  v_category text;
  v_cat_lower text;
  v_is_metro boolean;
  v_is_pizza_cat boolean;
  v_is_builder boolean;
  v_is_standard boolean;
  v_line text;
  v_rest text;
  v_match text[];
  v_slot integer;
  v_size_label text;
  v_size_count integer := 0;
  v_dough_label text;
  v_dough_count integer := 0;
  v_sauce_label text;
  v_sauce_count integer := 0;
  v_extras text[] := '{}';
  v_gusti jsonb := '{}'::jsonb;        -- slot -> pizza name
  v_size jsonb;
  v_dough jsonb;
  v_sauce jsonb;
  v_mult numeric;
  v_reference numeric;
  v_gusto_price numeric;
  v_extra text;
  v_extra_price numeric;
  v_extras_total numeric := 0;
  v_unit numeric;
  v_key text;
BEGIN
  SELECT p.name, p.price, c.name INTO v_name, v_price, v_category
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.id = p_product AND p.company_id = p_company AND p.active;
  IF NOT FOUND OR v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Invalid order lines';
  END IF;

  v_cfg := coalesce((SELECT m.config FROM public.menu_pricing m WHERE m.company_id = p_company),
                    public.menu_pricing_default());

  -- Category rules = lib/utils/menuCategories.ts
  v_cat_lower := lower(coalesce(v_category, ''));
  v_is_metro := v_cat_lower LIKE '%metro%';
  v_is_pizza_cat := btrim(v_cat_lower) LIKE '%pizz%'
    OR btrim(v_cat_lower) IN ('classiche', 'bianche', 'gustose', 'gourmet');
  v_is_builder := coalesce(v_name = v_cfg->>'builderProductName', false);
  v_is_standard := v_is_pizza_cat AND NOT v_is_metro AND coalesce(v_name, '') <> 'Piccola' AND NOT v_is_builder;

  -- Modifier lines (lib/utils/orderItemDetails.ts). Product line "[P] …" and
  -- the free-note line "Nota: …" carry no price.
  FOREACH v_line IN ARRAY regexp_split_to_array(coalesce(p_notes, ''), E'\n') LOOP
    v_line := regexp_replace(v_line, '^\s+|\s+$', '', 'g');
    CONTINUE WHEN v_line = '' OR v_line ~* '^\[P\]' OR v_line ~* '^Nota:';
    IF v_line ~* '^Taglia:' THEN
      v_size_label := regexp_replace(v_line, '^Taglia:\s*', '', 'i');
      v_size_count := v_size_count + 1;
    ELSIF v_line ~* '^Impasto:' THEN
      v_dough_label := regexp_replace(v_line, '^Impasto:\s*', '', 'i');
      v_dough_count := v_dough_count + 1;
    ELSIF v_line ~* '^Base:' THEN
      v_sauce_label := regexp_replace(v_line, '^Base:\s*', '', 'i');
      v_sauce_count := v_sauce_count + 1;
    ELSIF v_line ~ '^\+\s+' THEN
      v_extras := v_extras || regexp_replace(v_line, '^\+\s+', '');
    ELSIF v_line ~* '^Gusto(\s+[0-9]+)?:' THEN
      v_match := regexp_match(v_line, '^Gusto(?:\s+([0-9]+))?:\s*(.*)$', 'i');
      v_slot := coalesce(v_match[1], '1')::integer;
      v_rest := v_match[2];
      IF v_rest ~ '^\+\s+' THEN
        -- ingredient added to one mezzo metro gusto
        v_extras := v_extras || regexp_replace(v_rest, '^\+\s+', '');
      ELSIF v_rest ~* '^(No|Extra)\s+' THEN
        NULL;  -- removals / "more of" an ingredient already on the pizza: free (as in the client)
      ELSE
        IF v_gusti ? v_slot::text THEN
          RAISE EXCEPTION 'Invalid order lines';
        END IF;
        v_gusti := v_gusti || jsonb_build_object(v_slot::text, v_rest);
      END IF;
    END IF;
    -- anything else ("No …", "Extra …", "Cottura: …", free text): no price
  END LOOP;

  IF v_size_count > 1 OR v_dough_count > 1 OR v_sauce_count > 1 THEN
    RAISE EXCEPTION 'Invalid order lines';
  END IF;

  IF v_is_builder THEN
    -- Componi la tua pizza: base by size + dough + sauce + ingredients × size multiplier
    SELECT s INTO v_size FROM jsonb_array_elements(v_cfg->'builderSizes') s
    WHERE CASE WHEN v_size_count = 0 THEN s->>'id' = v_cfg->>'defaultBuilderSize' ELSE s->>'label' = v_size_label END;
    SELECT d INTO v_dough FROM jsonb_array_elements(v_cfg->'builderDoughs') WITH ORDINALITY AS x(d, n)
    WHERE CASE WHEN v_dough_count = 0 THEN n = 1 ELSE d->>'label' = v_dough_label END;
    SELECT d INTO v_sauce FROM jsonb_array_elements(v_cfg->'builderSauces') WITH ORDINALITY AS x(d, n)
    WHERE CASE WHEN v_sauce_count = 0 THEN n = 1 ELSE d->>'label' = v_sauce_label END;
    IF v_size IS NULL OR v_dough IS NULL OR v_sauce IS NULL THEN
      RAISE EXCEPTION 'Invalid order lines';
    END IF;
    v_mult := (v_size->>'ingredientMultiplier')::numeric;
    v_unit := (v_size->>'basePrice')::numeric + (v_dough->>'surcharge')::numeric + (v_sauce->>'surcharge')::numeric;
  ELSIF v_is_standard THEN
    IF v_dough_count > 0 OR v_sauce_count > 0 THEN
      RAISE EXCEPTION 'Invalid order lines';
    END IF;
    SELECT s INTO v_size FROM jsonb_array_elements(v_cfg->'menuSizes') s
    WHERE CASE WHEN v_size_count = 0 THEN s->>'id' = v_cfg->>'defaultMenuSize' ELSE s->>'label' = v_size_label END;
    IF v_size IS NULL THEN
      RAISE EXCEPTION 'Invalid order lines';
    END IF;
    -- client: added ingredients × multiplier only on mezzo metro, × 1 on the other sizes
    v_mult := CASE WHEN v_size->>'id' = 'mezzo_metro' THEN (v_size->>'ingredientMultiplier')::numeric ELSE 1 END;
    v_reference := v_price;
    IF v_size->>'id' = 'mezzo_metro' THEN
      -- Mezzo metro: multiplier × the most expensive gusto (menu pizzas of the
      -- same company, matched by name as written for the kitchen).
      IF (SELECT count(*) FROM jsonb_object_keys(v_gusti)) > (v_cfg->>'maxMezzoMetroGusti')::integer THEN
        RAISE EXCEPTION 'Invalid order lines';
      END IF;
      IF v_gusti <> '{}'::jsonb THEN
        v_reference := NULL;
        FOR v_key IN SELECT jsonb_object_keys(v_gusti) LOOP
          SELECT max(g.price) INTO v_gusto_price
          FROM public.products g
          JOIN public.categories gc ON gc.id = g.category_id
          WHERE g.company_id = p_company AND g.active AND g.name = v_gusti->>v_key
            AND g.name <> 'Piccola' AND g.name <> v_cfg->>'builderProductName'
            AND lower(gc.name) NOT LIKE '%metro%'
            AND (btrim(lower(gc.name)) LIKE '%pizz%' OR btrim(lower(gc.name)) IN ('classiche', 'bianche', 'gustose', 'gourmet'));
          IF v_gusto_price IS NULL THEN
            RAISE EXCEPTION 'Invalid order lines';
          END IF;
          v_reference := greatest(coalesce(v_reference, v_gusto_price), v_gusto_price);
        END LOOP;
      END IF;
    END IF;
    IF (v_size->>'priceMultiplier') IS NOT NULL AND (v_size->>'priceMultiplier')::numeric <> 1 THEN
      v_unit := greatest(0, round(v_reference * (v_size->>'priceMultiplier')::numeric, 2));
    ELSE
      v_unit := greatest(0, round(v_reference + (v_size->>'priceDelta')::numeric, 2));
    END IF;
  ELSE
    -- Al metro, drinks, desserts, …: list price (+ added ingredients). No sizes.
    IF v_size_count > 0 OR v_dough_count > 0 OR v_sauce_count > 0 THEN
      RAISE EXCEPTION 'Invalid order lines';
    END IF;
    v_mult := 1;
    v_unit := v_price;
  END IF;

  -- Added ingredients: category price × size ingredient multiplier.
  FOREACH v_extra IN ARRAY v_extras LOOP
    SELECT (v_cfg->'ingredientCategoryPrices'->>(i->>'category'))::numeric INTO v_extra_price
    FROM jsonb_array_elements(v_cfg->'ingredients') i
    WHERE lower(i->>'name') = lower(v_extra)
    LIMIT 1;
    IF v_extra_price IS NULL THEN
      RAISE EXCEPTION 'Invalid order lines';
    END IF;
    v_extras_total := v_extras_total + v_extra_price * v_mult;
    v_extra_price := NULL;
  END LOOP;

  RETURN round(v_unit + v_extras_total, 2);
END;
$$;
REVOKE ALL ON FUNCTION public.order_line_unit_price(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- 3) Delivery fee (same rule as AppSettingsContext: settings.deliveryFeeEur, default 2)
CREATE OR REPLACE FUNCTION public.order_delivery_fee(p_company uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT CASE WHEN jsonb_typeof(c.settings->'deliveryFeeEur') = 'number'
                  AND (c.settings->>'deliveryFeeEur')::numeric >= 0
                 THEN round((c.settings->>'deliveryFeeEur')::numeric, 2) END
     FROM public.companies c WHERE c.id = p_company),
    2);
$$;
REVOKE ALL ON FUNCTION public.order_delivery_fee(uuid) FROM PUBLIC, anon, authenticated;

-- 4) create_order_with_items: server prices ------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_order->>'id')::uuid;
  v_company uuid := (p_order->>'company_id')::uuid;
  v_customer uuid := nullif(p_order->>'customer_id', '')::uuid;
  v_existing jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_lines jsonb;
  v_subtotal numeric;
  v_fee numeric;
  v_total numeric;
  v_display_code text;
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
  -- SECURITY DEFINER: RLS does not apply inside, so every ownership rule is
  -- checked here. The order always belongs to the caller.
  IF v_customer IS NULL OR v_customer IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order customer does not match the current session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company AND active) THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;
  -- Active products of this company, sane quantities. Client prices are ignored.
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer)
    LEFT JOIN public.products p ON p.id = i.product_id AND p.company_id = v_company AND p.active
    WHERE p.id IS NULL OR i.quantity IS NULL OR i.quantity NOT BETWEEN 1 AND 1000
  ) THEN
    RAISE EXCEPTION 'Invalid order lines';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  v_existing := public.get_order_tracking(v_id);
  IF v_existing IS NOT NULL THEN
    -- Idempotent retry: same order, same lines. Prices are not compared (the
    -- saved ones are the server's; a retry returns them unchanged).
    IF (v_existing->>'company_id')::uuid IS DISTINCT FROM v_company
       OR nullif(v_existing->>'customer_id', '')::uuid IS DISTINCT FROM v_customer
       OR v_existing->>'order_type' IS DISTINCT FROM p_order->>'order_type'
       OR v_existing->>'notes' IS DISTINCT FROM p_order->>'notes'
       OR v_existing->>'delivery_address' IS DISTINCT FROM p_order->>'delivery_address'
       OR v_existing->>'table_number' IS DISTINCT FROM p_order->>'table_number'
       OR v_existing->>'customer_name' IS DISTINCT FROM p_order->>'customer_name'
       OR v_existing->>'customer_phone' IS DISTINCT FROM p_order->>'customer_phone' THEN
      RAISE EXCEPTION 'Retry does not match the saved order';
    END IF;
    SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity, i.notes) ORDER BY i.product_id, i.quantity, i.notes)
      INTO v_expected FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, notes text);
    SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity, i.notes) ORDER BY i.product_id, i.quantity, i.notes)
      INTO v_actual FROM jsonb_to_recordset(v_existing->'order_items') AS i(product_id uuid, quantity integer, notes text);
    IF v_expected IS DISTINCT FROM v_actual THEN
      RAISE EXCEPTION 'Retry does not match the saved order lines';
    END IF;
    RETURN jsonb_build_object(
      'id', v_id,
      'display_code', v_existing->>'display_code',
      'total_amount', v_existing->'total_amount',
      'items', (SELECT jsonb_agg(jsonb_build_object('product_id', i.product_id, 'quantity', i.quantity,
                  'unit_price', i.unit_price, 'total_price', i.total_price, 'notes', i.notes))
                FROM jsonb_to_recordset(v_existing->'order_items')
                  AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text)),
      'delivery_fee', (v_existing->>'total_amount')::numeric
        - coalesce((SELECT sum(i.total_price) FROM jsonb_to_recordset(v_existing->'order_items') AS i(total_price numeric)), 0));
  END IF;

  -- Server prices: per line from the listino, fee from the company settings.
  SELECT jsonb_agg(jsonb_build_object('product_id', l.product_id, 'quantity', l.quantity, 'notes', l.notes,
           'unit_price', l.unit_price, 'total_price', round(l.unit_price * l.quantity, 2)) ORDER BY l.ord)
    INTO v_lines
  FROM (
    SELECT e.ord, i.product_id, i.quantity, i.notes,
           public.order_line_unit_price(v_company, i.product_id, i.notes) AS unit_price
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord)
    CROSS JOIN LATERAL jsonb_to_record(e.item) AS i(product_id uuid, quantity integer, notes text)
  ) l;
  SELECT sum((l->>'total_price')::numeric) INTO v_subtotal FROM jsonb_array_elements(v_lines) l;
  v_fee := CASE WHEN p_order->>'order_type' = 'delivery' THEN public.order_delivery_fee(v_company) ELSE 0 END;
  v_total := round(v_subtotal + v_fee, 2);
  IF v_total IS NULL OR v_total < 0.01 THEN
    RAISE EXCEPTION 'Invalid order total';
  END IF;

  -- Antiabuso lato server (solo per ordini nuovi), sul totale calcolato dal server.
  PERFORM public.assert_order_antiabuse(v_company, v_total);

  -- The display code is always assigned here: any client display_code is
  -- ignored. Retries return the code already saved (above).
  v_display_code := public.reserve_order_display_code(v_company);

  INSERT INTO public.orders (id, company_id, customer_id, display_code, status, fiscal_status,
    total_amount, notes, order_type, customer_name, customer_phone, delivery_address, table_number)
  VALUES (v_id, v_company, v_customer, v_display_code, 'pending', 'pending',
    v_total, p_order->>'notes', p_order->>'order_type',
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'delivery_address', p_order->>'table_number');

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, notes)
  SELECT v_id, (l->>'product_id')::uuid, (l->>'quantity')::integer, (l->>'unit_price')::numeric,
         (l->>'total_price')::numeric, l->>'notes'
  FROM jsonb_array_elements(v_lines) l;

  v_existing := public.get_order_tracking(v_id);
  RETURN jsonb_build_object(
    'id', v_id,
    'display_code', v_existing->>'display_code',
    'total_amount', v_existing->'total_amount',
    'items', v_lines,
    'delivery_fee', v_fee);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO service_role;
  END IF;
END $$;
