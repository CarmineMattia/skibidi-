<!-- @format -->

# Fase 03 — Onboarding self-service ristoratore

## Obiettivo

Il prospect visita la **demo Skibidi** (ristorante inventato), capisce il prodotto, poi **decide lui** quando creare la propria company. Wizard self-serve (anche fatto **insieme** al primo cliente Ambrosia). Dopo il salvataggio atterra in **home** con **checklist prossimi passi**; non è “100% on” finché non completa.

## Fuori scope

- Editor gallery/SEO avanzato (fase 04 — può completare foto lì)
- Billing / piani a pagamento
- Domanda “che tipo di attività sei?” (inutile: si va al succo)
- Custom domain
- Path resolve (fase 05) — in v1 subdomain già pronto

## Prerequisiti

- Fase 01–02: branding dinamico + demo visibile

## Decisioni fissate (da Q&A)

| Tema | Decisione |
|------|-----------|
| Accesso | **Self-serve** aperto |
| Quando creare company | **Quando l’utente decide**, tipicamente dopo aver girato la demo |
| Tipo attività | **Non chiedere** — flusso diretto: nome, slug, contatti, orari, foto/menu |
| Post create | Atterraggio **home** + **prossimi passi** |
| Go-live 100% | Solo dopo checklist completata (`onboardingCompleted` / flag `goLiveReady`) |
| URL dopo create | **Subdomain già pronto**: `slug.skibidiorders.com` |
| Primo cliente | Ambrosia fatta **insieme** al ristoratore con questo stesso wizard |

### Chiarimento “campi obbligatori” (prima non chiaro)

Cosa serve **prima** di poter andare online al pubblico:

**Minimo per creare company (RPC):**
- account autenticato
- `name` (nome locale)
- `slug` valido e libero

**Minimo per checklist “quasi pronto” (home prossimi passi):**
- telefono
- indirizzo
- orari (almeno un giorno aperto)
- almeno **1 categoria + 1 prodotto** (anche con immagine URL)
- colore primary (default ok se skip)

**Minimo per “100% on” (`goLiveReady` / `onboardingCompleted: true`):**
- tutti i punti sopra
- conferma esplicita “Pubblica il mio locale” nello step finale

Logo e gallery completa (≥5) possono restare in checklist ma **non** bloccare create; gallery piena è fase 04 / prossimi passi.

## Contratto dati / API

### Funnel UX

```text
Apex / demo.skibidiorders.com
  → utente esplora menu/landing demo (banner “esempio”)
  → CTA “Apri il tuo locale” / “Inizia”
  → signup se serve
  → wizard create company
  → redirect home admin + checklist
  → (opzionale) apri slug.skibidiorders.com
```

### Step wizard (diretti, no tipo attività)

1. **Account** — login/signup
2. **Il tuo locale** — `name` + `slug` (preview live: `slug.skibidiorders.com`)
3. **Contatti** — phone, address, city (vat opzionale)
4. **Orari** — editor `businessHours` (unica fonte)
5. **Aspetto base** — primary color (default palette) + logo opzionale skip
6. **Primi prodotti** — 1…N prodotti con nome/prezzo/immagine URL o upload light
7. **Conferma** — crea/pubblica → home + checklist

`create_company_with_admin` può avvenire allo **step 2** (appena name+slug) così i salvataggi successivi aggiornano la company; oppure tutto atomico a step 7. **Scelta concreta:** create allo **step 2** (slug riservato subito), poi update progressivi — se abbandona, company resta `onboardingCompleted: false` e `active` può restare true ma gated.

### RPC `create_company_with_admin`

```ts
{ name: string; slug: string }
```

1. `auth.uid()` required  
2. slug libero + formato `[a-z0-9-]+`  
3. insert `companies` con `settings.branding` defaults + `onboardingCompleted: false`, `isDemo: false`  
4. `profiles`: `role=admin`, `company_id=new`  
5. return `{ company_id, slug }`  
6. Blocco: se utente è già admin di un’altra company → errore (v1: 1 locale per account)

Promozione admin **solo** in RPC (trigger signup resta `customer`).

### Checklist post go-live (home)

Voci tipiche (checkbox persistite in `settings.branding.checklist` o derivati):

- [ ] Orari impostati
- [ ] Almeno un prodotto nel menu
- [ ] Foto locale / hero
- [ ] Telefono e indirizzo
- [ ] Test ordine di prova
- [ ] Stampa / cucina verificata (manuale)
- [ ] **Pubblica** (set `onboardingCompleted: true`)

Finché non pubblica: banner “Configurazione in corso” sul sito pubblico (o sito non active — **scelta:** sito visibile ma banner “in allestimento” se admin loggato; guest vede menu se `active`).

**Scelta concreta:** `companies.active = true` dopo create; `onboardingCompleted = false` mostra banner “Presto online” / limita checkout? → **checkout disabilitato** finché `onboardingCompleted` (evita ordini su locale vuoto). Demo Skibidi ha `onboardingCompleted: true`.

### Route

- `app/onboarding/index.tsx`
- CTA da landing demo + login
- Guard: admin con onboarding incompleto può usare admin ma vede checklist; customer guest su subdomain nuovo → landing con banner + checkout off

## File toccati

| Path | Azione |
|------|--------|
| `supabase/migrations/…_create_company_with_admin.sql` | RPC |
| `app/onboarding/index.tsx` + `components/features/onboarding/*` | Wizard |
| `lib/api/onboarding.ts` | Client |
| `components/features/home/OnboardingChecklist.tsx` | Prossimi passi in home |
| `app/_layout.tsx` / guard | Soft gate checkout + checklist |
| `app/login.tsx` | CTA neutra “Apri il tuo locale” |

## Step di implementazione

1. RPC create + check slug + 1 company per admin.
2. CTA da demo → onboarding.
3. Wizard step 1–7 (create a step 2).
4. Editor orari riusando componenti admin-options se esistono.
5. Step prodotti minimi.
6. Checklist home + disable checkout se non completed.
7. Sessione “onboarding Ambrosia insieme”: script verbale / checklist umana allineata al wizard (doc breve nel MD o commento).

## Acceptance criteria

- [ ] Da demo → CTA → create company senza SQL
- [ ] Slug duplicato gestito
- [ ] Subdomain `slug.skibidiorders.com` resolve branding nuovo
- [ ] Checkout off finché `onboardingCompleted === false`
- [ ] Home admin mostra prossimi passi
- [ ] Ambrosia può essere creata con lo stesso flusso (nessun hardcode)
- [ ] Admin non può creare seconda company

## Rischi / note

- DNS wildcard deve essere live prima della sessione Ambrosia.
- Company abbandonate a metà: periodicamente `active=false` (ops futuro).
- Non chiedere tipo attività: pizza builder resta on di default (fase 05 non blocca).
