-- Consenso GDPR e profilazione clienti.
-- SOLO file di migration: NON applicato al database di produzione.
-- Applicare solo con l'OK esplicito di Carmine.
--
-- Due finalità distinte, opt-in, non pre-spuntate:
--   marketing  = offerte personalizzate in app (niente email)
--   profiling  = analisi dello storico ordini per quelle offerte e per
--                l'elenco nominativo dei clienti inattivi
-- Offerte mirate ed elenco inattivi solo se ENTRAMBI i consensi sono attivi
-- adesso. La revoca toglie la persona subito: non c'è una copia di marketing.
-- Le statistiche di insieme (giorno/ora, prodotti) contano tutti gli ordini
-- non annullati e non rifiutati e non riportano il cliente.
--
-- Chi scrive il proprio consenso: solo profiles.role = customer, e solo per
-- auth.uid(). Admin, kiosk e anon non accettano al posto di qualcuno.
-- Chi legge elenco e statistiche: admin della propria company, oppure
-- is_platform_owner() (public.platform_owners, migration della commissione).
-- Il cliente legge solo le proprie righe, tramite le RPC.
--
-- Il testo è una BOZZA (versione 2026-11-draft-1). I campi tra parentesi
-- quadre non sono stati inventati. Non è un parere legale.
-- Ordinare non dipende da questo consenso: questa migration non tocca
-- create_order_with_items né le tabelle ordini.

-- ---------------------------------------------------------------------------
-- Testo versionato. Una sola versione corrente. Immutabile dal browser.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consent_documents (
  version text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_documents_version_nonempty CHECK (length(btrim(version)) > 0),
  CONSTRAINT consent_documents_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT consent_documents_body_nonempty CHECK (length(btrim(body)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_documents_one_current_idx
  ON public.consent_documents (is_current)
  WHERE is_current;

ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Registro append-only. seq ordina anche due scelte nello stesso istante.
-- user_id non ha FK verso auth.users: cancellare l'account non deve
-- svuotare da solo la prova del consenso. Come trattare quella traccia
-- in caso di cancellazione è una decisione legale ancora aperta.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consent_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  purpose text NOT NULL,
  granted boolean NOT NULL,
  document_version text NOT NULL REFERENCES public.consent_documents (version),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT consent_events_purpose_check CHECK (purpose IN ('marketing', 'profiling'))
);

CREATE INDEX IF NOT EXISTS consent_events_user_purpose_seq_idx
  ON public.consent_events (user_id, purpose, seq DESC);

ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Soglia «inattivo», per pizzeria. Se manca la riga si usano 60 giorni.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiling_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  inactive_days integer NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiling_settings_inactive_days_range CHECK (inactive_days BETWEEN 7 AND 730)
);

ALTER TABLE public.profiling_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Guardie. Il browser non scrive, neanche con un GRANT futuro: current_user
-- e la GUC skibidi.consent_write devono coincidere. La GUC da sola non basta,
-- perché authenticated può chiamare set_config.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consent_documents_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'authenticator', 'service_role') THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'CONSENT_DOCUMENT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF current_setting('skibidi.consent_write', true) IS DISTINCT FROM 'seed' THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_documents_guard ON public.consent_documents;
CREATE TRIGGER consent_documents_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.consent_documents
  FOR EACH ROW EXECUTE FUNCTION public.consent_documents_guard();

CREATE OR REPLACE FUNCTION public.consent_events_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'CONSENT_APPEND_ONLY' USING ERRCODE = '55000';
  END IF;
  IF current_user IN ('anon', 'authenticated', 'authenticator', 'service_role') THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF current_setting('skibidi.consent_write', true) IS DISTINCT FROM 'event' THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NEW.purpose NOT IN ('marketing', 'profiling') THEN
    RAISE EXCEPTION 'CONSENT_PURPOSE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.consent_documents d
    WHERE d.version = NEW.document_version AND d.is_current
  ) THEN
    RAISE EXCEPTION 'CONSENT_VERSION_STALE' USING ERRCODE = '22023';
  END IF;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_events_guard ON public.consent_events;
CREATE TRIGGER consent_events_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.consent_events
  FOR EACH ROW EXECUTE FUNCTION public.consent_events_guard();

CREATE OR REPLACE FUNCTION public.profiling_settings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'authenticator', 'service_role') THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF current_setting('skibidi.consent_write', true) IS DISTINCT FROM 'settings' THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.company_id := OLD.company_id;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiling_settings_guard ON public.profiling_settings;
CREATE TRIGGER profiling_settings_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.profiling_settings
  FOR EACH ROW EXECUTE FUNCTION public.profiling_settings_guard();

CREATE OR REPLACE FUNCTION public.consent_block_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'consent_events' THEN
    RAISE EXCEPTION 'CONSENT_APPEND_ONLY' USING ERRCODE = '55000';
  END IF;
  IF TG_TABLE_NAME = 'consent_documents' THEN
    RAISE EXCEPTION 'CONSENT_DOCUMENT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS consent_documents_block_truncate ON public.consent_documents;
CREATE TRIGGER consent_documents_block_truncate
  BEFORE TRUNCATE ON public.consent_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.consent_block_truncate();

DROP TRIGGER IF EXISTS consent_events_block_truncate ON public.consent_events;
CREATE TRIGGER consent_events_block_truncate
  BEFORE TRUNCATE ON public.consent_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.consent_block_truncate();

DROP TRIGGER IF EXISTS profiling_settings_block_truncate ON public.profiling_settings;
CREATE TRIGGER profiling_settings_block_truncate
  BEFORE TRUNCATE ON public.profiling_settings
  FOR EACH STATEMENT EXECUTE FUNCTION public.consent_block_truncate();

-- Bozza. La seconda esecuzione non riscrive il testo già inserito.
DO $seed$
BEGIN
  PERFORM set_config('skibidi.consent_write', 'seed', true);
  INSERT INTO public.consent_documents (version, title, body, is_current)
  VALUES (
    '2026-11-draft-1',
    'Informativa privacy e consenso (bozza)',
    $consent_body$
BOZZA DA FAR RILEGGERE — NON È UN PARERE LEGALE.
Questo testo è una bozza da controllare da parte di Carmine e di chi cura la privacy della pizzeria (commercialista o legale). Non va trattato come testo definitivo finché non è stato riletto. I dati che non conosciamo sono tra parentesi quadre: non sono stati inventati.

1. Titolare del trattamento
Il titolare è Pizzeria Ambrosia.
Ragione sociale: [RAGIONE SOCIALE]
Partita IVA: [PARTITA IVA]
Sede: [SEDE LEGALE]
Email per la privacy: [EMAIL PRIVACY]

2. A cosa serve l'app
L'app serve a ordinare da Pizzeria Ambrosia. L'accesso è solo con Google. Il pagamento resta alla cassa: l'app non incassa il conto. Registrarsi, ordinare, pagare alla cassa e vedere lo stato dell'ordine funzionano anche senza i consensi di questa pagina.

3. Due scelte distinte, entrambe facoltative
Le caselle non sono pre-spuntate. Puoi accettarne una, entrambe o nessuna. Puoi cambiare idea quando vuoi, dallo stesso account, con un gesto uguale a quello con cui hai accettato.

Offerte personalizzate (marketing). Se accetti, nell'app possiamo mostrarti proposte pensate per te, per esempio la pizza che ordini più spesso. L'app non invia email né notifiche di marketing. Senza questo consenso non ti mostriamo offerte basate su di te. Le promozioni generiche del menu, uguali per tutti, restano visibili.

Profilazione. Se accetti, analizziamo lo storico dei tuoi ordini presso questa pizzeria (prodotti, quantità, data e ora) per ricavare le tue preferenze e per segnalare al titolare, con nome ed email, se non ordini da un periodo che lui imposta. All'inizio quel periodo è di 60 giorni. Senza questo consenso non usiamo il tuo storico per questi fini.

Le offerte su misura e l'elenco dei clienti inattivi si preparano solo se sono attivi entrambi i consensi. Se ne revoci anche uno solo, da quel momento non entri più in quelle elaborazioni e non le aggiorniamo più su di te.

4. Chi vede cosa
Tu vedi e modifichi solo le tue scelte. Se hai dato entrambi i consensi, vedi anche la proposta calcolata sui tuoi ordini.
Il titolare della pizzeria (ruolo admin) e i proprietari della piattaforma vedono le statistiche di insieme del locale (ordini per giorno della settimana e per fascia oraria, prodotti più richiesti) e, solo per chi ha entrambi i consensi attivi, l'elenco dei clienti inattivi con nome, email e data dell'ultimo ordine.
La cassa (ruolo kiosk), gli altri clienti e chi non è entrato nell'account non vedono queste informazioni.
Le statistiche di insieme non riportano il nome di una persona e valgono anche senza consenso: descrivono l'andamento del locale, non un cliente.

5. Base giuridica, da confermare
Proposta, da confermare con chi cura la privacy: i due consensi di questa pagina sono facoltativi e coprono solo marketing e profilazione. L'ordine, la preparazione, il ritiro e gli obblighi di cassa e fiscali non dipendono da questi consensi. Va anche confermato se questa profilazione rientra nelle decisioni automatizzate del Regolamento (UE) 2016/679: la proposta in app è un suggerimento, non un rifiuto del servizio.

6. Per quanto tempo
La traccia del consenso (chi, quale finalità, sì o no, data e ora, versione del testo mostrato) resta conservata per poter dimostrare la scelta, anche dopo una revoca. Durata proposta, da confermare: [DURATA CONSERVAZIONE CONSENSO].
I dati dell'ordine restano per il tempo richiesto dalla legge, anche se revochi. Dopo la revoca non li usiamo più per offerte o per l'elenco dei clienti inattivi.
Non teniamo un archivio di marketing separato: proposte ed elenco sono calcolati al momento, e solo se il consenso è ancora attivo. La traccia del consenso, da sola, non cancella l'account: un'eventuale cancellazione dell'account e della traccia va definita con chi cura la privacy. [CANCELLAZIONE ACCOUNT E TRACCIA CONSENSO]

7. Revoca e diritti
Puoi revocare ciascun consenso in qualsiasi momento dall'account, o dalla stessa schermata in cui ti viene chiesto. La revoca non annulla gli ordini già fatti e non chiude l'account.
Puoi chiedere accesso, rettifica e, nei limiti di legge, cancellazione, limitazione, opposizione e portabilità scrivendo a [EMAIL PRIVACY].
Puoi proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).

8. Minori
Oggi l'accesso è solo con Google e non c'è un controllo dell'età. Questa profilazione non è pensata per i minori. Età minima da confermare con il legale: [ETÀ MINIMA]. Se non si può escludere che l'account sia di un minore, il consenso non va raccolto.

9. Versione del testo
Versione mostrata: 2026-11-draft-1. Se il testo cambia, per accettare di nuovo serve la nuova versione. La revoca resta sempre possibile sulla versione corrente.

10. Chi tratta i dati per conto della pizzeria
Chi gestisce l'app e il database per conto di Pizzeria Ambrosia va qualificato nell'accordo che firmate (responsabile del trattamento o altro incarico). Nome e contatti: [RESPONSABILE DEL TRATTAMENTO].
Il login con Google è un servizio di Google. Qui usiamo l'identificativo dell'account per collegare gli ordini alla persona che li ha fatti.
$consent_body$,
    true
  )
  ON CONFLICT (version) DO NOTHING;
  PERFORM set_config('skibidi.consent_write', '', true);
END
$seed$;

-- ---------------------------------------------------------------------------
-- Stato corrente = ultima riga per (persona, finalità).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consent_is_active(p_user uuid, p_purpose text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT e.granted
    FROM public.consent_events e
    WHERE e.user_id = p_user
      AND e.purpose = p_purpose
    ORDER BY e.seq DESC
    LIMIT 1
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.consent_allows_personalisation(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.consent_is_active(p_user, 'marketing')
     AND public.consent_is_active(p_user, 'profiling');
$$;

CREATE OR REPLACE FUNCTION public.consent_caller_can_read_venue(p_company uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF coalesce(public.is_platform_owner(), false) THEN
    RETURN true;
  END IF;
  RETURN coalesce(public.is_admin(), false)
     AND p_company IS NOT DISTINCT FROM public.get_my_company_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.current_consent_document()
RETURNS TABLE (version text, title text, body text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT d.version, d.title, d.body
  FROM public.consent_documents d
  WHERE d.is_current
  ORDER BY d.created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_consent()
RETURNS TABLE (
  purpose text,
  granted boolean,
  document_version text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role::text = 'customer'
  ) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.purpose,
         coalesce(e.granted, false),
         e.document_version,
         e.created_at
  FROM (VALUES ('marketing'::text), ('profiling'::text)) AS p(purpose)
  LEFT JOIN LATERAL (
    SELECT ce.granted, ce.document_version, ce.created_at
    FROM public.consent_events ce
    WHERE ce.user_id = v_uid AND ce.purpose = p.purpose
    ORDER BY ce.seq DESC
    LIMIT 1
  ) e ON true
  ORDER BY p.purpose;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_consent_history()
RETURNS TABLE (
  purpose text,
  granted boolean,
  document_version text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role::text = 'customer'
  ) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.purpose, e.granted, e.document_version, e.created_at
  FROM public.consent_events e
  WHERE e.user_id = v_uid
  ORDER BY e.seq DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_consent(
  p_purpose text,
  p_granted boolean,
  p_document_version text
)
RETURNS TABLE (
  purpose text,
  granted boolean,
  document_version text,
  created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
  v_latest_granted boolean;
  v_latest_version text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role::text = 'customer'
  ) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_purpose IS NULL OR p_purpose NOT IN ('marketing', 'profiling') THEN
    RAISE EXCEPTION 'CONSENT_PURPOSE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_granted IS NULL THEN
    RAISE EXCEPTION 'CONSENT_VALUE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT d.version INTO v_current
  FROM public.consent_documents d
  WHERE d.is_current
  ORDER BY d.created_at DESC
  LIMIT 1;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'CONSENT_DOCUMENT_MISSING' USING ERRCODE = 'P0002';
  END IF;
  IF p_document_version IS DISTINCT FROM v_current THEN
    RAISE EXCEPTION 'CONSENT_VERSION_STALE' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('consent:' || v_uid::text, 0));

  SELECT e.granted, e.document_version
    INTO v_latest_granted, v_latest_version
  FROM public.consent_events e
  WHERE e.user_id = v_uid AND e.purpose = p_purpose
  ORDER BY e.seq DESC
  LIMIT 1;

  IF FOUND
     AND v_latest_granted IS NOT DISTINCT FROM p_granted
     AND v_latest_version IS NOT DISTINCT FROM p_document_version THEN
    RETURN QUERY
    SELECT e.purpose, e.granted, e.document_version, e.created_at
    FROM public.consent_events e
    WHERE e.user_id = v_uid AND e.purpose = p_purpose
    ORDER BY e.seq DESC
    LIMIT 1;
    RETURN;
  END IF;

  PERFORM set_config('skibidi.consent_write', 'event', true);
  INSERT INTO public.consent_events (user_id, purpose, granted, document_version)
  VALUES (v_uid, p_purpose, p_granted, p_document_version);
  PERFORM set_config('skibidi.consent_write', '', true);

  RETURN QUERY
  SELECT e.purpose, e.granted, e.document_version, e.created_at
  FROM public.consent_events e
  WHERE e.user_id = v_uid AND e.purpose = p_purpose
  ORDER BY e.seq DESC
  LIMIT 1;
END;
$$;

-- Nessuna lettura degli ordini se manca anche uno dei due consensi.
CREATE OR REPLACE FUNCTION public.my_personalised_offer(p_company uuid)
RETURNS TABLE (
  has_consent boolean,
  product_id uuid,
  product_name text,
  quantity_total integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role::text = 'customer'
  ) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT public.consent_allows_personalisation(v_uid) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0;
    RETURN;
  END IF;
  IF p_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'CONSENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT true,
         pick.product_id,
         pick.product_name,
         coalesce(pick.quantity_total, 0)::integer
  FROM (
    SELECT pr.id AS product_id,
           pr.name AS product_name,
           sum(i.quantity)::integer AS quantity_total
    FROM public.order_items i
    JOIN public.orders o ON o.id = i.order_id
    JOIN public.products pr ON pr.id = i.product_id
    WHERE o.company_id = p_company
      AND o.customer_id = v_uid
      AND o.status::text NOT IN ('cancelled', 'rejected')
    GROUP BY pr.id, pr.name
    ORDER BY sum(i.quantity) DESC, max(o.created_at) DESC, pr.name
    LIMIT 1
  ) pick
  UNION ALL
  SELECT true, NULL::uuid, NULL::text, 0
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.order_items i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.company_id = p_company
      AND o.customer_id = v_uid
      AND o.status::text NOT IN ('cancelled', 'rejected')
      AND i.product_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.profiling_inactive_days(p_company uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NOT public.consent_caller_can_read_venue(p_company) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'CONSENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT s.inactive_days INTO v_days
  FROM public.profiling_settings s
  WHERE s.company_id = p_company;
  RETURN coalesce(v_days, 60);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inactive_customer_days(p_company uuid, p_days integer)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.consent_caller_can_read_venue(p_company) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'CONSENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_days IS NULL OR p_days < 7 OR p_days > 730 THEN
    RAISE EXCEPTION 'CONSENT_DAYS_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('skibidi.consent_write', 'settings', true);
  INSERT INTO public.profiling_settings (company_id, inactive_days)
  VALUES (p_company, p_days)
  ON CONFLICT (company_id) DO UPDATE
    SET inactive_days = EXCLUDED.inactive_days;
  PERFORM set_config('skibidi.consent_write', '', true);
  RETURN p_days;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_inactive_customers(
  p_company uuid,
  p_inactive_days integer DEFAULT NULL
)
RETURNS TABLE (
  customer_id uuid,
  full_name text,
  email text,
  last_order_at timestamptz,
  days_since_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_days integer := p_inactive_days;
BEGIN
  IF NOT public.consent_caller_can_read_venue(p_company) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'CONSENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_days IS NULL THEN
    v_days := public.profiling_inactive_days(p_company);
  END IF;
  IF v_days < 7 OR v_days > 730 THEN
    RAISE EXCEPTION 'CONSENT_DAYS_INVALID' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH last_orders AS (
    SELECT o.customer_id, max(o.created_at) AS last_order_at
    FROM public.orders o
    WHERE o.company_id = p_company
      AND o.customer_id IS NOT NULL
      AND o.status::text NOT IN ('cancelled', 'rejected')
    GROUP BY o.customer_id
  )
  SELECT p.id,
         p.full_name,
         p.email,
         l.last_order_at,
         floor(extract(epoch FROM (now() - l.last_order_at)) / 86400)::integer
  FROM last_orders l
  JOIN public.profiles p ON p.id = l.customer_id
  WHERE p.role::text = 'customer'
    AND l.last_order_at < now() - make_interval(days => v_days)
    AND public.consent_allows_personalisation(p.id)
  ORDER BY l.last_order_at ASC, p.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.venue_orders_by_weekday_hour(p_company uuid)
RETURNS TABLE (
  weekday smallint,
  hour smallint,
  order_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.consent_caller_can_read_venue(p_company) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'CONSENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT extract(isodow FROM o.created_at AT TIME ZONE 'Europe/Rome')::smallint,
         extract(hour FROM o.created_at AT TIME ZONE 'Europe/Rome')::smallint,
         count(*)::integer
  FROM public.orders o
  WHERE o.company_id = p_company
    AND o.status::text NOT IN ('cancelled', 'rejected')
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.venue_top_products(p_company uuid, p_limit integer DEFAULT 8)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  quantity_total integer,
  order_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_limit integer := coalesce(p_limit, 8);
BEGIN
  IF NOT public.consent_caller_can_read_venue(p_company) THEN
    RAISE EXCEPTION 'CONSENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'CONSENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_limit < 1 OR v_limit > 20 THEN
    RAISE EXCEPTION 'CONSENT_LIMIT_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT pr.id,
         pr.name,
         sum(i.quantity)::integer,
         count(DISTINCT o.id)::integer
  FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  JOIN public.products pr ON pr.id = i.product_id
  WHERE o.company_id = p_company
    AND o.status::text NOT IN ('cancelled', 'rejected')
  GROUP BY pr.id, pr.name
  ORDER BY sum(i.quantity) DESC, pr.name
  LIMIT v_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Privilegi. Stesso schema della commissione: REVOKE ALL (e MAINTAIN su
-- PG 17), poi EXECUTE solo ad authenticated sulle RPC. anon non riceve nulla.
-- ---------------------------------------------------------------------------

DO $revoke$
DECLARE
  rel text;
  fn text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'public.consent_documents',
    'public.consent_events',
    'public.profiling_settings'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', rel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', rel);
    END IF;
    IF current_setting('server_version_num')::int >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM PUBLIC, anon, authenticated', rel);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM service_role', rel);
      END IF;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY ARRAY[
    'public.consent_documents_guard()',
    'public.consent_events_guard()',
    'public.profiling_settings_guard()',
    'public.consent_block_truncate()',
    'public.consent_is_active(uuid, text)',
    'public.consent_allows_personalisation(uuid)',
    'public.consent_caller_can_read_venue(uuid)',
    'public.current_consent_document()',
    'public.get_my_consent()',
    'public.get_my_consent_history()',
    'public.set_my_consent(text, boolean, text)',
    'public.my_personalised_offer(uuid)',
    'public.profiling_inactive_days(uuid)',
    'public.set_inactive_customer_days(uuid, integer)',
    'public.list_inactive_customers(uuid, integer)',
    'public.venue_orders_by_weekday_hour(uuid)',
    'public.venue_top_products(uuid, integer)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
END
$revoke$;

-- La sequence dell'identity non va lasciata a anon/authenticated.
DO $seq$
DECLARE
  seq text := pg_get_serial_sequence('public.consent_events', 'seq');
BEGIN
  IF seq IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM service_role', seq);
    END IF;
  END IF;
END
$seq$;

GRANT EXECUTE ON FUNCTION public.current_consent_document() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_consent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_consent_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_consent(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_personalised_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profiling_inactive_days(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_inactive_customer_days(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_inactive_customers(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.venue_orders_by_weekday_hour(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.venue_top_products(uuid, integer) TO authenticated;
