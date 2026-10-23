-- Server-side follow-ups (migration only in the PR; apply to prod only with Carmine's OK).
--
-- 1. Order notes (orders.notes, order_items.notes). One cleaning function,
--    public.clean_note_text(text), used by create_order_with_items (before pricing and in
--    the idempotent-retry comparison) AND by the BEFORE INSERT/UPDATE OF notes triggers,
--    so a retry with the same order id compares the same cleaned text that was saved:
--    - removed: zero-width / bidi / invisible format characters (U+00AD, U+034F, U+061C,
--      U+115F, U+1160, U+180E, U+200B, U+200C, U+200E, U+200F, U+202A-U+202E,
--      U+2060-U+2064, U+2066-U+2069, U+2800, U+3164, U+FEFF, U+FFA0, U+FFF9-U+FFFB,
--      U+1D173-U+1D17A): they can hide text or reorder what the kitchen reads
--      (e.g. a RLO turning "nessun extra" around);
--    - ZWJ (U+200D) is kept only between two emoji, so 👨‍🍳, ❤️‍🔥, 👨‍👩‍👧, 🏳️‍🌈 stay intact;
--      anywhere else it is removed;
--    - tag characters (U+E0000-U+E007F) are kept only inside the three RGI flags
--      🏴 gbeng / gbsct / gbwls (England, Scotland, Wales), removed everywhere else: any
--      other well-formed 🏴 + tags + CANCEL TAG could carry invisible ASCII text;
--    - Unicode line/paragraph separators and VT/FF/NEL (U+2028, U+2029, U+0085, U+000B,
--      U+000C) become a space: the kitchen would show them as new lines, so a free-text
--      note could look like an extra option line ("+ Burrata") the server never priced;
--    - CR and TAB are left as they are (ordinary whitespace; in line notes the pricer
--      already collapses them into a space).
--    Limits, counted after cleaning (prod max today: 143 / 87):
--    - order_items: the customer's free text (the final "Nota: ..." line) at most 1000
--      characters; the whole line (generated option lines included: a mezzo metro with
--      3 gusti x 12 extras is ~1240) at most 8000;
--    - orders.notes: at most 1000 (built by the app: payment / fulfillment tokens).
--    Over the limit: DETAIL 'ORDER_NOTES_TOO_LONG' (the client shows a clear message and
--    limits the note fields to 200 characters). CHECK constraints back up the totals.
--    The trigger function is SECURITY DEFINER (owner postgres) so it can call the helper,
--    which is not granted to any client role.
-- 2. reserve_order_display_code(uuid): EXECUTE revoked from PUBLIC/anon/authenticated.
--    Only orders_set_display_code() and create_order_with_items() call it, both
--    SECURITY DEFINER owned by postgres; the client never calls it
--    (tests/unit/orderSubmission.spec.ts).
-- 3. Menu reads without login (anon): only active products / categories of active
--    companies. Logged-in reads are unchanged (an admin still sees inactive products,
--    customers' order history still resolves old products). Companies were already
--    limited to active = true for everyone (companies_select). Order tracking uses
--    get_order_tracking (SECURITY DEFINER) and is not affected.
--
-- Idempotent.

-- 1) Order notes -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clean_note_text(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public AS $$
DECLARE
  -- emoji code points (approximation of Extended_Pictographic + keycap / VS16 / tag end)
  c_emoji constant text := '\u00A9\u00AE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A-\u23FF\u24C2\u25AA-\u27BF\u2934\u2935\u2B05-\u2B55\u3030\u303D\u3297\u3299\U0001F000-\U0001FAFF';
  v text;
  v_out text := '';
  v_seq text;
  v_pos integer;
BEGIN
  -- separators that would render as a new line -> space
  v := regexp_replace(p, '[\u2028\u2029\u0085\u000B\u000C]', ' ', 'g');
  -- invisible / bidi / filler characters
  v := regexp_replace(v, '[\u00AD\u034F\u061C\u115F\u1160\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u2800\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U0001D173-\U0001D17A]', '', 'g');
  -- tag characters: only inside the England / Scotland / Wales flags, removed everywhere else
  LOOP
    -- solo le 3 bandiere RGI (Inghilterra gbeng, Scozia gbsct, Galles gbwls): qualsiasi altra
    -- sequenza 🏴+tag potrebbe nascondere testo ASCII invisibile
    v_seq := substring(v FROM '\U0001F3F4\U000E0067\U000E0062(?:\U000E0065\U000E006E\U000E0067|\U000E0073\U000E0063\U000E0074|\U000E0077\U000E006C\U000E0073)\U000E007F');
    EXIT WHEN v_seq IS NULL;
    v_pos := strpos(v, v_seq);
    v_out := v_out || regexp_replace(substr(v, 1, v_pos - 1), '[\U000E0000-\U000E007F]', '', 'g') || v_seq;
    v := substr(v, v_pos + char_length(v_seq));
  END LOOP;
  v := v_out || regexp_replace(v, '[\U000E0000-\U000E007F]', '', 'g');
  -- ZWJ: only between two emoji (VS16 / keycap / tag end allowed before it)
  v := regexp_replace(v,
    '(?<![' || c_emoji || '\uFE0F\u20E3\U000E007F])\u200D|\u200D(?![' || c_emoji || '])', '', 'g');
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.clean_note_text(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clean_order_notes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_free text;
  v_free_max integer;
  v_total_max integer;
BEGIN
  IF NEW.notes IS NOT NULL THEN
    NEW.notes := public.clean_note_text(NEW.notes);
    IF TG_TABLE_NAME = 'order_items' THEN
      -- customer's free text = the final "Nota: ..." line (canonical form of order_line_priced)
      v_free := substring(NEW.notes FROM '(?:^|\n)Nota: ([^\n]*)$');
      v_free_max := 1000;
      v_total_max := 8000;
    ELSE
      v_free := NEW.notes;  -- orders.notes: built by the app, limited as a whole
      v_free_max := 1000;
      v_total_max := 1000;
    END IF;
    IF char_length(coalesce(v_free, '')) > v_free_max OR char_length(NEW.notes) > v_total_max THEN
      RAISE EXCEPTION 'Order notes too long' USING ERRCODE = '22001', DETAIL = 'ORDER_NOTES_TOO_LONG',
        HINT = json_build_object('table', TG_TABLE_NAME, 'length', char_length(NEW.notes),
                                 'free_text_length', char_length(coalesce(v_free, '')))::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.clean_order_notes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_clean_notes ON public.orders;
CREATE TRIGGER trg_orders_clean_notes BEFORE INSERT OR UPDATE OF notes ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.clean_order_notes();
DROP TRIGGER IF EXISTS trg_order_items_clean_notes ON public.order_items;
CREATE TRIGGER trg_order_items_clean_notes BEFORE INSERT OR UPDATE OF notes ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.clean_order_notes();

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_notes_length;
ALTER TABLE public.orders ADD CONSTRAINT orders_notes_length CHECK (char_length(notes) <= 1000);
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_notes_length;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_notes_length CHECK (char_length(notes) <= 8000);

-- create_order_with_items (#33 version) with the notes cleaned once, before pricing,
-- so the saved row and the idempotent retry comparison use the same text.
-- Changes vs 20261020150000: v_order_notes / v_items (clean_note_text), retry
-- comparison of the order note, pricing and INSERT from the cleaned values.
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
  -- notes cleaned once, here, with the same function the trigger uses (retry = save)
  v_order_notes text := public.clean_note_text(p_order->>'notes');
  v_items jsonb;
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

  -- line notes cleaned before pricing: the saved canonical note and the retry
  -- comparison both come from order_line_priced(clean_note_text(notes)).
  SELECT jsonb_agg(CASE WHEN e.item ? 'notes' AND jsonb_typeof(e.item->'notes') = 'string'
                        THEN jsonb_set(e.item, '{notes}', to_jsonb(public.clean_note_text(e.item->>'notes')))
                        ELSE e.item END ORDER BY e.ord)
    INTO v_items FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  v_existing := public.get_order_tracking(v_id);
  IF v_existing IS NOT NULL THEN
    -- Idempotent retry: same order, same lines. Prices are not compared (the
    -- saved ones are the server's; a retry returns them unchanged).
    IF (v_existing->>'company_id')::uuid IS DISTINCT FROM v_company
       OR nullif(v_existing->>'customer_id', '')::uuid IS DISTINCT FROM v_customer
       OR v_existing->>'order_type' IS DISTINCT FROM p_order->>'order_type'
       OR (v_existing->>'notes' IS DISTINCT FROM v_order_notes
           AND v_existing->>'notes' IS DISTINCT FROM p_order->>'notes')
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
          INTO v_normalised FROM jsonb_to_recordset(v_items) AS i(product_id uuid, quantity integer, notes text);
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
    FROM jsonb_array_elements(v_items) WITH ORDINALITY AS e(item, ord)
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
    v_total, v_order_notes, p_order->>'order_type',
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

-- 2) Display code reservation: server only -----------------------------------
REVOKE EXECUTE ON FUNCTION public.reserve_order_display_code(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Menu without login: active rows of active companies only -----------------
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products
  FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL
      AND active
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = products.company_id AND c.active))
    OR ((SELECT auth.uid()) IS NOT NULL
      AND ((company_id = (SELECT public.get_my_company_id()))
        OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = products.company_id AND c.active)))
  );

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
  FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL
      AND active
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = categories.company_id AND c.active))
    OR ((SELECT auth.uid()) IS NOT NULL
      AND ((company_id = (SELECT public.get_my_company_id()))
        OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = categories.company_id AND c.active)))
  );
