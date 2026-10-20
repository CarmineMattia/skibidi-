-- Server-side pricing (migration only in the PR; apply to prod only with Carmine's OK).
--
-- create_order_with_items now prices every order on the server and ignores
-- the client's unit_price / total_price / total_amount:
--   * unit price per line from the product list price plus the "structured"
--     listino (sizes, mezzo metro, Componi la tua pizza, added ingredients),
--     read from the same modifier lines the kitchen sees in order_items.notes
--     ("Taglia: …", "+ …", "Gusto N: …", "Impasto: …", "Base: …"), so what is
--     made is what is paid;
--   * delivery fee from companies.settings.deliveryFeeEur (absent → 2, as the
--     client; invalid → order refused) for order_type = 'delivery';
--   * order total = Σ lines + fee; rejected below 0.01 €; anti-abuse (max
--     total) runs on the server total.
-- Inactive products, products of another company and any modifier line that
-- is not a canonical option valid for that product are rejected (see 2), so
-- the kitchen never shows an option that was not charged. order_items.notes
-- is saved in canonical form (the exact lines that were priced).
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

-- 2) One order line: strict modifier grammar, price, canonical notes ----------
-- order_items.notes is what the kitchen card / print show (lib/utils/
-- orderItemDetails.ts). To charge exactly what the kitchen sees, every line
-- before "Nota:" must be an option the app can produce, in its canonical form
-- (lib/data/menuPricing.ts buildMenuItemModifiers, lib/data/pizzaBuilder.ts
-- buildMezzoMetroModifiers / buildSelectionModifiers), valid for that product:
--   [P] <name>                      first line, optional; rewritten with the DB name
--   Taglia: <size label>            menu pizzas (menuSizes) / builder (builderSizes)
--   Impasto: <dough> / Base: <sauce> builder only
--   + <catalogue ingredient>        added ingredient (priced by category)
--   No <ing> / Extra <ing>          <ing> must be on the product (products.ingredients); free
--   Gusto: <pizza> / Gusto N: <pizza>   mezzo metro (N = 1..k, k >= 2) and the al metro
--                                   products that require gusti (Metà / Due terzi / Farcita)
--   Gusto[ N]: + X / No X / Extra X mezzo metro only, X checked on that gusto
--   Cottura: Poco cotta|Normale|Ben cotta   pizzas only
--   Nota: <customer text>           optional, exactly one, last, single line
-- Anything else (legacy "a, b" / " | " shapes, "Taglia :", "+Burrata", "＋",
-- bare text, lowercase labels, duplicates, Gusto on a normal size, …) is
-- rejected: 'Invalid order lines' with DETAIL = ORDER_INVALID_OPTIONS /
-- ORDER_INVALID_NOTE / ORDER_PRODUCT_UNAVAILABLE and HINT = {"product_id", "line"}.
CREATE OR REPLACE FUNCTION public.order_line_reject(p_code text, p_product uuid, p_line text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Invalid order lines'
    USING DETAIL = p_code, HINT = jsonb_build_object('product_id', p_product, 'line', p_line)::text;
END;
$$;
REVOKE ALL ON FUNCTION public.order_line_reject(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- lib/utils/menuCategories.ts getMaxGustiForProduct (al metro products)
CREATE OR REPLACE FUNCTION public.menu_metro_max_gusti(p_name text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN position('metà' IN lower(p_name)) > 0 OR position('meta ' IN lower(p_name)) > 0 THEN 1
    WHEN position('due terzi' IN lower(p_name)) > 0 THEN 2
    WHEN position('farcita' IN lower(p_name)) > 0 THEN 3
    ELSE 0 END;
$$;
REVOKE ALL ON FUNCTION public.menu_metro_max_gusti(text) FROM PUBLIC, anon, authenticated;

-- Cooking labels (lib/data/menuPricing.ts COOKING_OPTIONS; no price).
CREATE OR REPLACE FUNCTION public.menu_cooking_labels()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT ARRAY['Poco cotta', 'Normale', 'Ben cotta']::text[]; $$;
REVOKE ALL ON FUNCTION public.menu_cooking_labels() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.order_line_unit_price(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.order_line_priced(p_company uuid, p_product uuid, p_notes text)
RETURNS jsonb  -- {"unit_price": numeric, "notes": canonical text}
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cfg jsonb;
  v_name text;
  v_price numeric;
  v_ingredients text[];
  v_category text;
  v_cat text;
  v_is_metro boolean;
  v_is_pizza_cat boolean;
  v_is_beverage boolean;
  v_is_builder boolean;
  v_is_standard boolean;
  v_is_pizza boolean;
  v_tools boolean;
  v_max_metro integer;
  v_lines text[];
  v_line text;
  v_rest text;
  v_m text[];
  v_i integer;
  v_slot integer;
  v_mods text[] := '{}';
  v_note text;
  v_has_note boolean := false;
  v_size_label text;
  v_dough_label text;
  v_sauce_label text;
  v_cook_label text;
  v_plain_extras text[] := '{}';
  v_plain_mods text[] := '{}';           -- ingredient names with No / Extra
  v_slot_names jsonb := '{}'::jsonb;      -- slot -> pizza name
  v_slot_extras jsonb := '[]'::jsonb;     -- [slot, ingredient]
  v_slot_mods jsonb := '[]'::jsonb;       -- [slot, ingredient]
  v_numbered boolean := false;
  v_unnumbered boolean := false;
  v_slot_count integer;
  v_size jsonb;
  v_dough jsonb;
  v_sauce jsonb;
  v_mult numeric := 1;
  v_reference numeric;
  v_gusto_price numeric;
  v_gusto_ings text[];
  v_key text;
  v_extra text;
  v_extra_price numeric;
  v_extras_total numeric := 0;
  v_unit numeric;
  v_all_extras text[] := '{}';
BEGIN
  SELECT p.name, p.price, p.ingredients, c.name INTO v_name, v_price, v_ingredients, v_category
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.id = p_product AND p.company_id = p_company AND p.active;
  IF NOT FOUND OR v_price IS NULL OR v_price < 0 THEN
    PERFORM public.order_line_reject('ORDER_PRODUCT_UNAVAILABLE', p_product);
  END IF;
  v_name := btrim(coalesce(v_name, ''));
  v_ingredients := ARRAY(SELECT btrim(i) FROM unnest(coalesce(v_ingredients, '{}'::text[])) AS i);

  v_cfg := coalesce((SELECT m.config FROM public.menu_pricing m WHERE m.company_id = p_company),
                    public.menu_pricing_default());

  -- Category rules = lib/utils/menuCategories.ts / menuPricing.getMenuItemFlags
  v_cat := lower(coalesce(v_category, ''));
  v_is_metro := v_cat LIKE '%metro%';
  v_is_beverage := v_cat LIKE '%bevand%';
  v_is_pizza_cat := btrim(v_cat) LIKE '%pizz%' OR btrim(v_cat) IN ('classiche', 'bianche', 'gustose', 'gourmet');
  v_is_builder := v_name = v_cfg->>'builderProductName';
  v_is_standard := v_is_pizza_cat AND NOT v_is_metro AND v_name <> 'Piccola' AND NOT v_is_builder;
  v_is_pizza := v_is_pizza_cat OR v_is_metro;
  v_tools := NOT v_is_beverage AND (v_is_pizza OR v_is_builder OR cardinality(v_ingredients) > 0);
  v_max_metro := CASE WHEN v_is_metro THEN public.menu_metro_max_gusti(v_name) ELSE 0 END;

  v_lines := CASE WHEN coalesce(p_notes, '') = '' THEN '{}'::text[] ELSE string_to_array(p_notes, E'\n') END;
  FOR v_i IN 1 .. coalesce(array_length(v_lines, 1), 0) LOOP
    v_line := v_lines[v_i];
    IF v_has_note THEN
      -- the note is the last line: nothing (no second note, no option) after it
      PERFORM public.order_line_reject('ORDER_INVALID_NOTE', p_product, v_line);
    END IF;
    IF v_i = 1 AND v_line LIKE '[P]%' THEN
      CONTINUE;  -- product snapshot, rewritten below with the DB name
    END IF;
    IF v_line = 'Nota:' OR v_line LIKE 'Nota: %' THEN
      v_has_note := true;
      -- customer text: one line, whitespace collapsed; no control characters
      v_note := btrim(regexp_replace(substr(v_line, 6), '[[:space:]]+', ' ', 'g'));
      IF v_note ~ '[[:cntrl:]]' THEN
        PERFORM public.order_line_reject('ORDER_INVALID_NOTE', p_product, v_line);
      END IF;
      CONTINUE;
    END IF;

    IF v_line LIKE 'Taglia: %' AND v_size_label IS NULL THEN
      v_size_label := substr(v_line, 9);
    ELSIF v_line LIKE 'Impasto: %' AND v_dough_label IS NULL AND v_is_builder THEN
      v_dough_label := substr(v_line, 10);
    ELSIF v_line LIKE 'Base: %' AND v_sauce_label IS NULL AND v_is_builder THEN
      v_sauce_label := substr(v_line, 7);
    ELSIF v_line LIKE 'Cottura: %' AND v_cook_label IS NULL AND (v_is_pizza OR v_is_builder) THEN
      v_cook_label := substr(v_line, 10);
      IF NOT v_cook_label = ANY (public.menu_cooking_labels()) THEN
        PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
      END IF;
    ELSIF v_line LIKE '+ %' AND v_tools THEN
      v_plain_extras := v_plain_extras || substr(v_line, 3);
    ELSIF (v_line LIKE 'No %' OR v_line LIKE 'Extra %') AND v_tools AND NOT v_is_builder THEN
      v_rest := CASE WHEN v_line LIKE 'No %' THEN substr(v_line, 4) ELSE substr(v_line, 7) END;
      IF NOT v_rest = ANY (v_ingredients) OR v_rest = ANY (v_plain_mods) THEN
        PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
      END IF;
      v_plain_mods := v_plain_mods || v_rest;
    ELSIF v_line ~ '^Gusto( [1-9][0-9]?)?: ' AND (v_is_standard OR v_max_metro > 0) THEN
      v_m := regexp_match(v_line, '^Gusto(?: ([1-9][0-9]?))?: (.*)$');
      v_slot := coalesce(v_m[1]::integer, 0);
      v_rest := v_m[2];
      IF v_slot = 0 THEN v_unnumbered := true; ELSE v_numbered := true; END IF;
      IF v_rest LIKE '+ %' OR v_rest LIKE 'No %' OR v_rest LIKE 'Extra %' THEN
        -- per-gusto option: mezzo metro only, after that gusto's name
        IF NOT v_is_standard OR NOT v_slot_names ? v_slot::text THEN
          PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
        END IF;
        IF v_rest LIKE '+ %' THEN
          v_slot_extras := v_slot_extras || jsonb_build_array(jsonb_build_array(v_slot, substr(v_rest, 3)));
        ELSE
          v_rest := CASE WHEN v_rest LIKE 'No %' THEN substr(v_rest, 4) ELSE substr(v_rest, 7) END;
          IF v_slot_mods @> jsonb_build_array(jsonb_build_array(v_slot, v_rest)) THEN
            PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
          END IF;
          v_slot_mods := v_slot_mods || jsonb_build_array(jsonb_build_array(v_slot, v_rest));
        END IF;
      ELSE
        IF v_slot_names ? v_slot::text OR v_rest = '' THEN
          PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
        END IF;
        v_slot_names := v_slot_names || jsonb_build_object(v_slot::text, v_rest);
      END IF;
    ELSE
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
    END IF;
    IF v_line = ANY (v_mods) THEN
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, v_line);
    END IF;
    v_mods := v_mods || v_line;
  END LOOP;

  -- Gusto slots: "Gusto:" (one) or "Gusto 1..k:" (k >= 2), never mixed.
  v_slot_count := (SELECT count(*) FROM jsonb_object_keys(v_slot_names));
  IF v_numbered AND v_unnumbered THEN
    PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Gusto');
  END IF;
  IF v_numbered AND (
       (SELECT array_agg(k::integer ORDER BY k::integer) FROM jsonb_object_keys(v_slot_names) k)
       IS DISTINCT FROM ARRAY(SELECT generate_series(1, v_slot_count))) THEN
    PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Gusto');
  END IF;

  IF v_is_builder THEN
    -- Componi la tua pizza: base by size + dough + sauce + ingredients × size multiplier
    SELECT s INTO v_size FROM jsonb_array_elements(v_cfg->'builderSizes') s
    WHERE CASE WHEN v_size_label IS NULL THEN s->>'id' = v_cfg->>'defaultBuilderSize' ELSE s->>'label' = v_size_label END;
    SELECT d INTO v_dough FROM jsonb_array_elements(v_cfg->'builderDoughs') WITH ORDINALITY AS x(d, n)
    WHERE CASE WHEN v_dough_label IS NULL THEN n = 1 ELSE d->>'label' = v_dough_label END;
    SELECT d INTO v_sauce FROM jsonb_array_elements(v_cfg->'builderSauces') WITH ORDINALITY AS x(d, n)
    WHERE CASE WHEN v_sauce_label IS NULL THEN n = 1 ELSE d->>'label' = v_sauce_label END;
    IF v_size IS NULL OR v_dough IS NULL OR v_sauce IS NULL THEN
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product,
        coalesce(CASE WHEN v_size IS NULL THEN 'Taglia: ' || v_size_label END,
                 CASE WHEN v_dough IS NULL THEN 'Impasto: ' || v_dough_label END,
                 'Base: ' || v_sauce_label));
    END IF;
    v_mult := (v_size->>'ingredientMultiplier')::numeric;
    v_unit := (v_size->>'basePrice')::numeric + (v_dough->>'surcharge')::numeric + (v_sauce->>'surcharge')::numeric;
    v_all_extras := v_plain_extras;
  ELSIF v_is_standard THEN
    SELECT s INTO v_size FROM jsonb_array_elements(v_cfg->'menuSizes') s
    WHERE CASE WHEN v_size_label IS NULL THEN s->>'id' = v_cfg->>'defaultMenuSize' ELSE s->>'label' = v_size_label END;
    IF v_size IS NULL THEN
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Taglia: ' || v_size_label);
    END IF;
    v_reference := v_price;
    IF v_size->>'id' = 'mezzo_metro' THEN
      -- Mezzo metro: multiplier × the most expensive gusto (menu pizzas of the
      -- same company, by name); extras per gusto × ingredientMultiplier.
      -- No gusto lines = the product itself (as the client).
      IF cardinality(v_plain_extras) > 0 OR cardinality(v_plain_mods) > 0
         OR (v_numbered AND v_slot_count < 2)
         OR v_slot_count > (v_cfg->>'maxMezzoMetroGusti')::integer THEN
        PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Taglia: Mezzo metro');
      END IF;
      v_mult := (v_size->>'ingredientMultiplier')::numeric;
      IF v_slot_count > 0 THEN
        v_reference := NULL;
        FOR v_key IN SELECT jsonb_object_keys(v_slot_names) LOOP
          SELECT g.price, ARRAY(SELECT btrim(i) FROM unnest(coalesce(g.ingredients, '{}'::text[])) i)
            INTO v_gusto_price, v_gusto_ings
          FROM public.products g
          JOIN public.categories gc ON gc.id = g.category_id
          WHERE g.company_id = p_company AND g.active AND btrim(g.name) = v_slot_names->>v_key
            AND btrim(g.name) <> 'Piccola' AND btrim(g.name) <> v_cfg->>'builderProductName'
            AND lower(gc.name) NOT LIKE '%metro%'
            AND (btrim(lower(gc.name)) LIKE '%pizz%' OR btrim(lower(gc.name)) IN ('classiche', 'bianche', 'gustose', 'gourmet'))
          ORDER BY g.price DESC, g.id
          LIMIT 1;
          IF NOT FOUND OR v_gusto_price IS NULL THEN
            PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product,
              CASE WHEN v_key = '0' THEN 'Gusto: ' ELSE 'Gusto ' || v_key || ': ' END || (v_slot_names->>v_key));
          END IF;
          -- per-gusto No / Extra only on that gusto's ingredients
          IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_slot_mods) sm
                     WHERE (sm->>0) = v_key AND NOT (sm->>1) = ANY (coalesce(v_gusto_ings, '{}'::text[]))) THEN
            PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Gusto ' || v_key);
          END IF;
          v_reference := greatest(coalesce(v_reference, v_gusto_price), v_gusto_price);
        END LOOP;
      ELSIF jsonb_array_length(v_slot_mods) > 0 OR jsonb_array_length(v_slot_extras) > 0 THEN
        PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Gusto');
      END IF;
      v_all_extras := ARRAY(SELECT e->>1 FROM jsonb_array_elements(v_slot_extras) e);
    ELSE
      -- normal sizes: no gusti; added ingredients × 1 (as the client)
      IF v_slot_count > 0 OR jsonb_array_length(v_slot_mods) > 0 OR jsonb_array_length(v_slot_extras) > 0 THEN
        PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Gusto');
      END IF;
      v_all_extras := v_plain_extras;
    END IF;
    IF (v_size->>'priceMultiplier') IS NOT NULL AND (v_size->>'priceMultiplier')::numeric <> 1 THEN
      v_unit := greatest(0, round(v_reference * (v_size->>'priceMultiplier')::numeric, 2));
    ELSE
      v_unit := greatest(0, round(v_reference + (v_size->>'priceDelta')::numeric, 2));
    END IF;
  ELSE
    -- Al metro, drinks, desserts, …: list price (+ added ingredients × 1). No sizes.
    IF v_size_label IS NOT NULL THEN
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Taglia: ' || v_size_label);
    END IF;
    -- al metro gusti: the product sheet asks for exactly getMaxGustiForProduct
    -- gusti ("Gusto:" when 1, "Gusto 1..k:" otherwise); free, as in the client.
    IF v_slot_count > v_max_metro
       OR (v_max_metro = 1 AND v_numbered) OR (v_max_metro > 1 AND v_unnumbered) THEN
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, 'Gusto');
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(v_slot_names) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.products g JOIN public.categories gc ON gc.id = g.category_id
        WHERE g.company_id = p_company AND g.active AND btrim(g.name) = v_slot_names->>v_key
          AND btrim(g.name) <> 'Piccola' AND btrim(g.name) <> v_cfg->>'builderProductName'
          AND lower(gc.name) NOT LIKE '%metro%'
          AND (btrim(lower(gc.name)) LIKE '%pizz%' OR btrim(lower(gc.name)) IN ('classiche', 'bianche', 'gustose', 'gourmet'))) THEN
        PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product,
          CASE WHEN v_key = '0' THEN 'Gusto: ' ELSE 'Gusto ' || v_key || ': ' END || (v_slot_names->>v_key));
      END IF;
    END LOOP;
    v_unit := v_price;
    v_all_extras := v_plain_extras;
  END IF;

  -- Added ingredients: catalogue name (exact) → category price × multiplier.
  FOREACH v_extra IN ARRAY v_all_extras LOOP
    v_extra_price := NULL;
    SELECT (v_cfg->'ingredientCategoryPrices'->>(i->>'category'))::numeric INTO v_extra_price
    FROM jsonb_array_elements(v_cfg->'ingredients') i
    WHERE i->>'name' = v_extra
    LIMIT 1;
    IF v_extra_price IS NULL THEN
      PERFORM public.order_line_reject('ORDER_INVALID_OPTIONS', p_product, '+ ' || v_extra);
    END IF;
    v_extras_total := v_extras_total + v_extra_price * v_mult;
  END LOOP;

  RETURN jsonb_build_object(
    'unit_price', round(v_unit + v_extras_total, 2),
    'notes', array_to_string(
      ARRAY['[P] ' || v_name] || v_mods || CASE WHEN coalesce(v_note, '') <> '' THEN ARRAY['Nota: ' || v_note] ELSE '{}'::text[] END,
      E'\n'));
END;
$$;
REVOKE ALL ON FUNCTION public.order_line_priced(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- 3) Delivery fee: companies.settings.deliveryFeeEur (absent / null → 2, as
-- AppSettingsContext). A present but invalid value (not a JSON number,
-- negative, more than 2 decimals) is a configuration error: refuse the order
-- instead of guessing a fee.
CREATE OR REPLACE FUNCTION public.order_delivery_fee(p_company uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_raw jsonb;
  v_fee numeric;
BEGIN
  SELECT c.settings->'deliveryFeeEur' INTO v_raw FROM public.companies c WHERE c.id = p_company;
  IF v_raw IS NULL OR v_raw = 'null'::jsonb THEN
    RETURN 2;
  END IF;
  IF jsonb_typeof(v_raw) <> 'number' THEN
    RAISE EXCEPTION 'Delivery fee misconfigured' USING DETAIL = 'ORDER_DELIVERY_FEE_INVALID';
  END IF;
  v_fee := (v_raw #>> '{}')::numeric;
  IF v_fee < 0 OR v_fee <> round(v_fee, 2) THEN
    RAISE EXCEPTION 'Delivery fee misconfigured' USING DETAIL = 'ORDER_DELIVERY_FEE_INVALID';
  END IF;
  RETURN v_fee;
END;
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
  v_unavailable uuid;
  v_normalised jsonb;
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
  -- Sane quantities; active products of this company (named in the error so
  -- the app can say which cart line is no longer available). Client prices are ignored.
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer)
    WHERE i.product_id IS NULL OR i.quantity IS NULL OR i.quantity NOT BETWEEN 1 AND 1000
  ) THEN
    RAISE EXCEPTION 'Invalid order lines' USING DETAIL = 'ORDER_INVALID_QUANTITY';
  END IF;
  SELECT i.product_id INTO v_unavailable
  FROM jsonb_to_recordset(p_items) AS i(product_id uuid)
  LEFT JOIN public.products p ON p.id = i.product_id AND p.company_id = v_company AND p.active
  WHERE p.id IS NULL
  LIMIT 1;
  IF FOUND THEN
    PERFORM public.order_line_reject('ORDER_PRODUCT_UNAVAILABLE', v_unavailable);
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
      -- saved notes are the canonical form: compare that too (e.g. NULL notes
      -- saved as "[P] <name>", note whitespace collapsed)
      BEGIN
        SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity,
                 public.order_line_priced(v_company, i.product_id, i.notes)->>'notes')
                 ORDER BY i.product_id, i.quantity, public.order_line_priced(v_company, i.product_id, i.notes)->>'notes')
          INTO v_normalised FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, notes text);
      EXCEPTION WHEN raise_exception THEN
        v_normalised := NULL;
      END;
      IF v_normalised IS DISTINCT FROM v_actual THEN
        RAISE EXCEPTION 'Retry does not match the saved order lines';
      END IF;
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
  -- Notes are saved in canonical form: exactly the lines that were priced.
  SELECT jsonb_agg(jsonb_build_object('product_id', l.product_id, 'quantity', l.quantity,
           'notes', l.priced->>'notes', 'unit_price', (l.priced->>'unit_price')::numeric,
           'total_price', round((l.priced->>'unit_price')::numeric * l.quantity, 2)) ORDER BY l.ord)
    INTO v_lines
  FROM (
    SELECT e.ord, i.product_id, i.quantity,
           public.order_line_priced(v_company, i.product_id, i.notes) AS priced
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord)
    CROSS JOIN LATERAL jsonb_to_record(e.item) AS i(product_id uuid, quantity integer, notes text)
  ) l;
  SELECT sum((l->>'total_price')::numeric) INTO v_subtotal FROM jsonb_array_elements(v_lines) l;
  v_fee := CASE WHEN p_order->>'order_type' = 'delivery' THEN public.order_delivery_fee(v_company) ELSE 0 END;
  v_total := round(v_subtotal + v_fee, 2);
  IF v_total IS NULL OR v_total < 0.01 THEN
    RAISE EXCEPTION 'Invalid order total' USING DETAIL = 'ORDER_TOTAL_TOO_LOW';
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
