-- Numeri ordine leggibili e divertenti per il cliente (es. "Diavola #12")

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS display_code text;

CREATE TABLE IF NOT EXISTS order_daily_counters (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  counter integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, day)
);

CREATE OR REPLACE FUNCTION reserve_order_display_code(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter integer;
  v_names text[] := ARRAY[
    'Margherita', 'Diavola', 'Bufala', 'Tartufo', 'Patate', 'Ortolana', 'Marinara',
    'Carbonara', 'Speck', 'Porcini', 'Gamberi', 'Bresaola', 'Nduja', 'Capricciosa',
    '4 Formaggi', 'Prosciutto', 'Wurstel', 'Funghi', 'Rucola', 'Norma'
  ];
  v_name text;
BEGIN
  INSERT INTO order_daily_counters (company_id, day, counter)
  VALUES (p_company_id, current_date, 1)
  ON CONFLICT (company_id, day)
  DO UPDATE SET counter = order_daily_counters.counter + 1
  RETURNING counter INTO v_counter;

  v_name := v_names[1 + floor(random() * array_length(v_names, 1))::int];
  RETURN v_name || ' #' || v_counter::text;
END;
$$;

REVOKE ALL ON FUNCTION reserve_order_display_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_order_display_code(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION orders_set_display_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.display_code IS NULL OR btrim(NEW.display_code) = '' THEN
    NEW.display_code := reserve_order_display_code(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_display_code ON orders;
CREATE TRIGGER trg_orders_display_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION orders_set_display_code();
