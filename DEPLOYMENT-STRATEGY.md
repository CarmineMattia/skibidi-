<!-- @format -->

# Deployment Strategy — SKIBIDI ORDERS

> Documento strategico per portare il progetto in produzione e gestire multiple aziende/ristoranti sulla stessa piattaforma.

---

## 1. Risposta rapida alle domande chiave

| Domanda                           | Risposta                                         |
| --------------------------------- | ------------------------------------------------ |
| Un DB o uno per azienda?          | **Un DB, multi-tenant via `company_id` + RLS**   |
| Branch per ogni azienda?          | **No. Un solo codebase, config per tenant**      |
| GitHub Pages? Netlify?            | **Vercel** per il web, **EAS** per mobile        |
| Serve Nginx?                      | **No — Vercel lo gestisce automaticamente**      |
| I dati dei clienti sono separati? | **Sì, via RLS su `company_id` — ma va aggiunto** |

---

## 2. Architettura Multi-Tenant (la modifica più critica)

### Il problema attuale

Il database attuale **non ha isolamento tra aziende**. Se domani configuri un secondo ristorante con lo stesso DB, entrambi vedono gli stessi menu, ordini e clienti. Questo va risolto **prima** di onboardare il secondo cliente.

### La soluzione: Single DB + company_id su tutti i record

```
companies           ← nuova tabella master
    id, name, slug, plan, settings, created_at

profiles            ← aggiungere company_id
categories          ← aggiungere company_id
products            ← aggiungere company_id
orders              ← aggiungere company_id
order_items         ← ereditato da orders (no campo, join)
fiscal_audit_log    ← aggiungere company_id
fiscal_retry_queue  ← aggiungere company_id
```

### Come funziona l'isolamento

Ogni RLS policy diventa:

```sql
-- PRIMA (attuale — senza isolamento)
CREATE POLICY "Admins can update products" ON products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DOPO (multi-tenant — con isolamento)
CREATE POLICY "Admins can update products" ON products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND company_id = products.company_id   -- ← questa riga fa tutto
    )
  );
```

Con questa policy, l'admin della Pizzeria Mario può modificare solo i prodotti della Pizzeria Mario. Impossibile vedere o toccare i dati di un altro ristorante, anche se hanno lo stesso DB.

### Come l'app sa quale azienda caricare

**Strategia consigliata: subdomain routing**

```
pizzeriamario.skibidiorders.com   → company_id = "abc-123"
burgerking.skibidiorders.com      → company_id = "def-456"
```

La tabella `companies` ha un campo `slug` univoco. All'avvio dell'app:

```typescript
// lib/api/tenant.ts
const hostname = window?.location?.hostname ?? "";
const slug = hostname.split(".")[0]; // "pizzeriamario"

const { data: company } = await supabase.from("companies").select("id, name, settings").eq("slug", slug).single();

// Salvato nel context, usato in ogni query
```

Per kiosk/app nativa: `company_id` va messo in `app.config.js` come variabile di ambiente durante il build EAS.

---

## 3. Admin Panel — Cosa manca

L'attuale `admin-options.tsx` ha solo il toggle kiosk. Serve molto di più.

### Sezioni da costruire

#### 3.1 Gestione Menu

- Lista categorie con drag & drop per `display_order` ✅ parziale (EditProductModal esiste)
- Crea / modifica / archivia categoria
- Crea / modifica / archivia prodotto con immagine upload
- Toggle attivo/disattivo senza cancellare

#### 3.2 Gestione Ordini

- Lista ordini con filtri (data, stato, tipo)
- Export CSV/Excel per contabilità
- Storno ordine + void fiscale

#### 3.3 Dashboard & Analytics

- Revenue giornaliero/settimanale/mensile
- Prodotti più venduti
- Orari di punta (heatmap ordini)
- Ordini per tipo (tavolo / asporto / delivery)

#### 3.4 Gestione Staff (admin)

- Lista utenti dell'azienda
- Invita nuovo admin / staff
- Modifica ruolo (admin / kitchen staff / customer)
- Revoca accesso

#### 3.5 Impostazioni Azienda

- Nome, logo, indirizzo, P.IVA
- Orari di apertura
- Metodi di pagamento abilitati
- Configurazione fiscale (provider, credenziali RT)
- Impostazioni delivery (raggio, costo)

#### 3.6 Dispositivi Kiosk

- Lista dispositivi registrati come kiosk
- Reset remoto kiosk
- Assign kiosk a punto vendita specifico (per catene)

### Struttura file suggerita

```
app/
  (admin)/
    _layout.tsx          ← AdminGuard + navigazione admin
    dashboard.tsx        ← Analytics
    menu/
      index.tsx          ← Lista prodotti/categorie
      product/[id].tsx   ← Edit prodotto
    orders/
      index.tsx          ← Lista ordini
      [id].tsx           ← Dettaglio ordine
    staff.tsx            ← Gestione utenti
    settings.tsx         ← Impostazioni azienda
    devices.tsx          ← Gestione kiosk
```

---

## 4. Deployment — Hosting e CI/CD

### Stack raccomandato

```
Web App         → Vercel (gratis fino a ~100k req/mese, poi $20/mese)
Mobile (iOS)    → EAS Build + App Store
Mobile (Android)→ EAS Build + Play Store
Backend DB      → Supabase (già in uso)
Storage (img)   → Supabase Storage (già incluso)
Email           → Resend.com (integrazione nativa Supabase)
```

**Perché Vercel e non Netlify/GitHub Pages:**

- Expo Router ha bisogno di server-side rewrites per il routing → Vercel li supporta nativamente
- GitHub Pages serve solo siti statici, non funziona bene con Expo Router v3+
- Vercel ha edge network globale e zero-config deploy da GitHub

**Nginx:** non serve. Vercel gestisce SSL, CDN, routing, compression, headers — tutto automatico.

### Setup CI/CD

```yaml
# Flusso automatico su push

main branch  →  deploy production  (app.skibidiorders.com)
develop      →  deploy preview     (dev.skibidiorders.com)
PR           →  deploy preview URL temporaneo per review
```

**Configurazione Vercel (`vercel.json`):**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

**Deploy mobile con EAS:**

```bash
# Build per produzione
eas build --platform all --profile production

# Submit agli store
eas submit --platform ios
eas submit --platform android

# OTA update (no store review — solo JS changes)
eas update --branch production --message "Fix: cart bug"
```

---

## 5. Onboarding di una nuova azienda

### Flow completo

```
1. Admin crea company in Supabase Dashboard (o via funzione admin)
   INSERT INTO companies (name, slug, plan) VALUES ('Pizzeria Mario', 'pizzeria-mario', 'starter')

2. Crea utente admin per quell'azienda
   → Auth Supabase + profiles con company_id + role = 'admin'

3. Configura DNS
   pizzeria-mario.skibidiorders.com → CNAME → cname.vercel-dns.com

4. L'admin del ristorante accede, crea categorie e prodotti

5. (Opzionale) Build EAS custom con company_id per app nativa kiosk
   EXPO_PUBLIC_COMPANY_ID=abc-123 eas build --profile kiosk
```

### Piani/Tier (da definire)

```
Starter  → 1 dispositivo kiosk, 1 admin, fiscal mock
Pro      → 3 dispositivi, 3 admin, fiscal reale, analytics
Business → illimitato, multi-location, white-label
```

La tabella `companies` ha un campo `plan` e `settings` (JSONB) per feature flags per tenant.

---

## 6. Isolamento dati clienti — Garanzie

### A livello DB

Con `company_id` + RLS, Postgres garantisce che ogni query restituisce **solo i record della propria azienda**, anche se un bug nel frontend manda una query sbagliata. L'RLS viene applicata **prima** che i dati vengano restituiti.

```sql
-- Questa query fatta dall'admin di Pizzeria Mario
SELECT * FROM orders;

-- Restituisce SOLO gli ordini dove orders.company_id = profilo.company_id
-- Anche senza WHERE clause — l'RLS lo applica automaticamente
```

### A livello applicativo

- Il `company_id` viene letto dall'hostname/config all'avvio e non cambia durante la sessione
- Il `CartContext` e `AuthContext` includono `companyId` e tutte le query lo passano come filtro
- Un admin non può mai cercare/modificare utenti di un'altra company

### A livello Auth

- Ogni utente (profile) è legato a una `company_id`
- Il JWT di Supabase contiene i claims dell'utente — non ha accesso cross-tenant
- Se un utente prova ad accedere a un subdomain diverso dal suo, vede solo i propri dati (filtro company_id del suo profile)

### GDPR (clienti kiosk anonimi)

- Ordini kiosk: `customer_id = null`, `customer_name` opzionale
- Nessun dato personale obbligatorio per ordine kiosk
- Retention policy: purge automatico ordini older than X giorni (da configurare per company)

---

## 7. Migrazione al multi-tenant — Roadmap tecnica

### Step 1 — Aggiungi tabella companies (1 giorno)

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter',
  settings JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 2 — Aggiungi company_id a tutte le tabelle (2 ore)

```sql
ALTER TABLE profiles    ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE categories  ADD COLUMN company_id UUID REFERENCES companies(id) NOT NULL;
ALTER TABLE products    ADD COLUMN company_id UUID REFERENCES companies(id) NOT NULL;
ALTER TABLE orders      ADD COLUMN company_id UUID REFERENCES companies(id);
-- fiscal tables: aggiorna tramite join a orders
```

### Step 3 — Aggiorna RLS policies (mezzo giorno)

Aggiungi `AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())` a tutte le policy esistenti.

### Step 4 — Aggiorna il frontend (1 giorno)

- `TenantContext` che legge `company_id` dall'hostname
- Tutte le query includono `.eq('company_id', companyId)`
- `handle_new_user()` trigger assegna `company_id` dal claim JWT o dal parametro di registrazione

### Step 5 — Admin panel base (3-5 giorni)

Almeno: gestione prodotti/categorie, lista ordini, impostazioni azienda.

---

## 8. Checklist pre-produzione

### Infrastruttura

- [ ] DNS configurato (dominio principale + wildcard `*.skibidiorders.com`)
- [ ] Vercel progetto creato e collegato al repo GitHub
- [ ] Variabili d'ambiente configurate in Vercel (non solo .env locale)
- [ ] Supabase Pro plan attivato (connection pooling, più connessioni)
- [ ] Supabase backups abilitati (Point-in-Time Recovery)

### Sicurezza

- [ ] Migrazione multi-tenant completata (company_id + RLS aggiornate)
- [ ] Service Role Key **mai** nel frontend (solo Edge Functions)
- [ ] Rate limiting su Supabase API (via Supabase Dashboard)
- [ ] CORS configurato (solo domini autorizzati)
- [ ] Headers di sicurezza in vercel.json

### Fiscale / legale

- [ ] Provider fiscale reale configurato (Acube o Fatture-in-Cloud)
- [ ] Test di emissione scontrino su RT di test
- [ ] Retry queue testata su failure
- [ ] Audit log verificato (ogni scontrino tracciato)
- [ ] Privacy policy + cookie banner (GDPR)
- [ ] Termini di servizio

### App

- [ ] EAS build iOS firmato con certificato App Store
- [ ] EAS build Android firmato con keystore
- [ ] OTA update configurato (canali: production, staging)
- [ ] Error monitoring (Sentry consigliato — `npx expo install @sentry/react-native`)
- [ ] Analytics base (Expo Analytics o PostHog self-hosted)

### Testing

- [ ] Test E2E del flusso ordine su produzione staging
- [ ] Test isolamento dati (admin company A non vede ordini company B)
- [ ] Test kiosk mode su dispositivo fisico
- [ ] Test offline → riconnessione → sync ordini pendenti
- [ ] Load test (almeno 50 ordini simultanei per venue)

---

## 9. Monitoraggio in produzione

```
Supabase Dashboard  → Query slow, connessioni, errori DB
Vercel Analytics    → Page views, Core Web Vitals, errori
Sentry              → Crash reports iOS/Android/Web
Uptime Robot (free) → Ping ogni 5min, alert se down
```

Per le fiscal operations: la tabella `fiscal_audit_log` è già il monitor principale — un admin dashboard che mostra il tasso di successo/errore delle emissioni è sufficiente per fase 1.

---

## 10. Costi stimati (produzione, 1-3 ristoranti)

| Servizio       | Piano      | Costo/mese                |
| -------------- | ---------- | ------------------------- |
| Vercel         | Pro        | $20                       |
| Supabase       | Pro        | $25                       |
| EAS Build      | Production | $29 (99 build/mese)       |
| Dominio        | -          | ~$15/anno                 |
| Sentry         | Free       | $0                        |
| Resend (email) | Free       | $0 (fino a 3k email/mese) |
| **Totale**     |            | **~$75/mese**             |

Con 3 ristoranti a €49/mese ciascuno = €147 entrate vs ~€75 costi. Margine positivo da subito.

---

_Documento aggiornato: 2026-03-26_
_Versione: 1.0_
