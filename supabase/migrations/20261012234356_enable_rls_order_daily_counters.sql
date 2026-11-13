-- Abilita la RLS su order_daily_counters (era esposta ad anon/authenticated).
-- Nessuna policy: l'accesso diretto via API viene negato.
-- reserve_order_display_code(uuid) è SECURITY DEFINER con owner postgres
-- (bypassrls), quindi la generazione del codice ordine continua a funzionare.
ALTER TABLE public.order_daily_counters ENABLE ROW LEVEL SECURITY;
