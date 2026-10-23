-- Staff / server path to issue pending receipts (migration only in the PR;
-- apply to prod only with Carmine's OK).
--
-- After 20261023100000_server_side_receipt_status only an admin of the company
-- (or the server) can write the receipt outcome. Customer and kiosk orders stay
-- fiscal_status 'pending', and before this PR no screen listed them and nothing
-- issued them. This migration adds the server side of "Emetti scontrino":
--
--   * public.order_receipt_claims: a short lease per order, so two tills cannot
--     issue the same receipt at the same time. RLS on, no policies and no grants:
--     only the two functions below read or write it.
--   * claim_order_receipt(order): admin of the order's company or service_role.
--     The order must be accepted / preparing / ready / delivered, not empty, and
--     its receipt 'pending' or 'error'. Takes the lease (a stale lease, older
--     than 2 minutes, is replaced) and returns the receipt data read from the DB
--     (server prices, lines with product names, total), so the client never
--     decides what goes on the receipt. A receipt already 'success' is returned
--     as already_issued, without a lease.
--   * record_order_receipt(order, claim, ...): same callers; needs the lease
--     from claim_order_receipt. Writes fiscal_status / fiscal_external_id /
--     pdf_url (never notes or anything else), one fiscal_audit_log row, and
--     releases the lease. A receipt already 'success' is never overwritten.
--
-- The receipt itself is still produced by the app's FiscalService (mock
-- provider by default; no provider config changes here). Not found and
-- "other company" give the same RECEIPT_FORBIDDEN error.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.order_receipt_claims (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  claimed_by uuid,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_receipt_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_receipt_claims FROM PUBLIC, anon, authenticated;

-- Who may issue a receipt for an order of p_company.
CREATE OR REPLACE FUNCTION public.receipt_caller_can_issue(p_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR (coalesce(auth.role(), '') = 'authenticated'
          AND p_company IS NOT NULL
          AND public.is_admin()
          AND p_company = public.get_my_company_id());
$$;
REVOKE EXECUTE ON FUNCTION public.receipt_caller_can_issue(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_order_receipt(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_claim uuid := gen_random_uuid();
  v_items jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.receipt_caller_can_issue(v_order.company_id) THEN
    RAISE EXCEPTION 'Receipt not allowed' USING ERRCODE = '42501', DETAIL = 'RECEIPT_FORBIDDEN';
  END IF;

  IF v_order.fiscal_status::text = 'success' THEN
    RETURN jsonb_build_object('order_id', v_order.id, 'already_issued', true,
      'external_id', v_order.fiscal_external_id, 'pdf_url', v_order.pdf_url);
  END IF;
  IF v_order.fiscal_status::text NOT IN ('pending', 'error') THEN
    RAISE EXCEPTION 'Receipt not issuable' USING DETAIL = 'RECEIPT_NOT_ISSUABLE';
  END IF;
  -- Only orders the restaurant took: not awaiting approval, not cancelled / rejected.
  IF v_order.status::text NOT IN ('accepted', 'preparing', 'ready', 'delivered') THEN
    RAISE EXCEPTION 'Order not billable' USING DETAIL = 'RECEIPT_ORDER_NOT_BILLABLE';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'product_id', i.product_id,
           'name', coalesce(nullif(btrim(p.name), ''), 'Prodotto'),
           'quantity', i.quantity,
           'unit_price', i.unit_price,
           'total_price', i.total_price) ORDER BY i.id)
    INTO v_items
  FROM public.order_items i
  LEFT JOIN public.products p ON p.id = i.product_id
  WHERE i.order_id = v_order.id;
  IF v_items IS NULL OR v_order.total_amount IS NULL OR v_order.total_amount < 0.01 THEN
    RAISE EXCEPTION 'Order is empty' USING DETAIL = 'RECEIPT_ORDER_EMPTY';
  END IF;

  -- Lease: a stale one (> 2 min, e.g. a till that crashed) is replaced.
  DELETE FROM public.order_receipt_claims
   WHERE order_id = v_order.id AND claimed_at < now() - interval '2 minutes';
  INSERT INTO public.order_receipt_claims (order_id, claim_id, claimed_by, claimed_at)
  VALUES (v_order.id, v_claim, auth.uid(), now())
  ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt already in progress' USING DETAIL = 'RECEIPT_IN_PROGRESS';
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'already_issued', false,
    'claim_id', v_claim,
    'display_code', v_order.display_code,
    'customer_name', v_order.customer_name,
    'created_at', v_order.created_at,
    'fiscal_status', v_order.fiscal_status::text,
    'total_amount', v_order.total_amount,
    'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_receipt(
  p_order_id uuid,
  p_claim_id uuid,
  p_success boolean,
  p_external_id text DEFAULT NULL,
  p_pdf_url text DEFAULT NULL,
  p_provider text DEFAULT 'mock',
  p_error text DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_external text := nullif(btrim(coalesce(p_external_id, '')), '');
  v_pdf text := nullif(btrim(coalesce(p_pdf_url, '')), '');
  v_provider text := left(coalesce(nullif(btrim(p_provider), ''), 'mock'), 50);
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.receipt_caller_can_issue(v_order.company_id) THEN
    RAISE EXCEPTION 'Receipt not allowed' USING ERRCODE = '42501', DETAIL = 'RECEIPT_FORBIDDEN';
  END IF;
  IF p_claim_id IS NULL OR p_success IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.order_receipt_claims WHERE order_id = p_order_id AND claim_id = p_claim_id
  ) THEN
    RAISE EXCEPTION 'Receipt claim missing or expired' USING DETAIL = 'RECEIPT_CLAIM_INVALID';
  END IF;

  IF v_order.fiscal_status::text = 'success' THEN
    DELETE FROM public.order_receipt_claims WHERE order_id = p_order_id;
    RETURN jsonb_build_object('order_id', v_order.id, 'already_issued', true, 'fiscal_status', 'success',
      'external_id', v_order.fiscal_external_id, 'pdf_url', v_order.pdf_url);
  END IF;

  IF p_success THEN
    IF v_external IS NULL OR char_length(v_external) > 200 THEN
      RAISE EXCEPTION 'Invalid receipt id' USING DETAIL = 'RECEIPT_INVALID_RESULT';
    END IF;
    IF v_pdf IS NOT NULL AND (v_pdf !~ '^https://[^[:space:]]+$' OR char_length(v_pdf) > 2000) THEN
      RAISE EXCEPTION 'Invalid receipt link' USING DETAIL = 'RECEIPT_INVALID_RESULT';
    END IF;
    UPDATE public.orders
       SET fiscal_status = 'success', fiscal_external_id = v_external, pdf_url = v_pdf
     WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET fiscal_status = 'error' WHERE id = p_order_id;
  END IF;

  INSERT INTO public.fiscal_audit_log (order_id, company_id, action, provider, external_id,
    request_data, response_data, status, error_message, error_code)
  VALUES (p_order_id, v_order.company_id, 'emit', v_provider, v_external,
    jsonb_build_object('claim_id', p_claim_id, 'by', auth.uid(), 'role', auth.role()),
    CASE WHEN p_success THEN jsonb_build_object('pdf_url', v_pdf) END,
    CASE WHEN p_success THEN 'success' ELSE 'error' END,
    CASE WHEN NOT p_success THEN left(coalesce(p_error, 'Errore sconosciuto'), 500) END,
    CASE WHEN NOT p_success THEN left(p_error_code, 50) END);

  DELETE FROM public.order_receipt_claims WHERE order_id = p_order_id;

  RETURN jsonb_build_object('order_id', v_order.id, 'already_issued', false,
    'fiscal_status', CASE WHEN p_success THEN 'success' ELSE 'error' END,
    'external_id', CASE WHEN p_success THEN v_external END,
    'pdf_url', CASE WHEN p_success THEN v_pdf END);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_receipt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_order_receipt(uuid, uuid, boolean, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_order_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_receipt(uuid, uuid, boolean, text, text, text, text, text) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_order_receipt(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.record_order_receipt(uuid, uuid, boolean, text, text, text, text, text) TO service_role;
  END IF;
END $$;
