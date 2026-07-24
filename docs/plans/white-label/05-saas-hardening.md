<!-- @format -->

# Fase 05 — Hardening SaaS

## Obiettivo

Rendere solida l’operatività multi-tenant dopo branding/onboarding/admin: resolve di backup via path, apex che spiega il prodotto Skibidi (demo inventata), runbook DNS. **Niente** sistema complicato di “lucchetti per piano” in v1.

## Fuori scope

- Billing / Stripe
- Feature gating per piano a pagamento (spiegato sotto: rimandato)
- Domanda tipo attività
- Secondo seed “Ambrosia” in codice — Ambrosia nasce da onboarding reale
- Store listing white-label automatico

## Prerequisiti

- Fasi 01–04 ok in staging
- Wildcard DNS `*.skibidiorders.com`

## Decisioni fissate (da Q&A)

| Tema | Decisione |
|------|-----------|
| Path slug | Sì, prefisso **`/r/[slug]`** per evitare collisioni con `/login`, `/offers`, … |
| “Gating feature” | **Non farlo in v1** (vedi chiarimento) |
| Tipo attività | **Non chiedere** — default pizza stack acceso |
| Apex | **Home = landing prodotto Skibidi** che mostra/collega la demo inventata + flag “ristorante di esempio” |
| Secondo tenant test | **No** Ambrosia seed; solo demo generale inventata. Ambrosia = onboarding reale |

### Chiarimento “prefisso `/r/[slug]`”

Oggi il locale si apre così: `pizzeria-da-mario.skibidiorders.com`.  
A volte (test, preview, DNS non pronto) serve un URL sul dominio principale senza subdomain.

Se usassimo `skibidiorders.com/pizzeria-da-mario`, rischiamo di confonderlo con pagine app (`/login`, `/kitchen`, …).  
Perciò: **`skibidiorders.com/r/pizzeria-da-mario`** — la `r` sta per “restaurant/locale”. Subdomain resta il modo principale.

### Chiarimento “feature gating”

Vuol dire “nascondere funzioni in base al piano free/starter/business” (es. gallery solo se paghi).  
**In v1 non lo implementiamo**: tutti i locali self-serve hanno le stesse funzioni base. Il campo `companies.plan` può restare documentato ma senza lucchetti UI. Si riprende quando esiste billing.

## Contratto dati / API

### 1. Resolve order (aggiornato)

1. `EXPO_PUBLIC_COMPANY_ID`  
2. Subdomain slug  
3. Path `/r/[slug]`  
4. Dev fallback → company demo Skibidi  

### 2. Apex `skibidiorders.com`

- Non caricare un tenant ristorante “per sbaglio” come Ambrosia  
- Mostrare marketing prodotto: cos’è Skibidi, CTA “Prova la demo”, CTA “Apri il tuo locale”  
- Demo = tenant inventato (`demo` / `isDemo`) con banner chiaro  

### 3. Features verticali (leggero, no wizard tipo)

Opzionale in `settings.features` con default:

```ts
{ pizzaBuilder: true, doughBallTracking: true, tableOrdering: true, delivery: true }
```

Niente schermata “che attività sei?”. Spegnere a mano in admin solo se serve dopo. **Priorità bassa** rispetto a path + apex + DNS.

### 4. Runbook deploy

Aggiornare `DEPLOYMENT-STRATEGY.md`:

1. Wildcard DNS → hosting  
2. Auth redirect URLs wildcard  
3. Onboarding self-serve = path primario (sessione Ambrosia inclusa)  
4. Native: EAS + `EXPO_PUBLIC_COMPANY_ID`  
5. Smoke: demo apex → create slug → subdomain → ordine → kitchen  

## File toccati

| Path | Azione |
|------|--------|
| `TenantContext.tsx` | Path `/r/[slug]` |
| `app/r/[slug]/_layout.tsx` (o equivalente) | Bind tenant da path |
| Landing apex / marketing | Home piattaforma + link demo |
| `DEPLOYMENT-STRATEGY.md` | Allineamento self-serve |
| (opz.) `settings.features` | Default on, no gating piani |

## Step di implementazione

1. Route `/r/[slug]` + resolve.  
2. Apex marketing distinto dal tenant demo.  
3. Banner `isDemo` già da fase 02 — verificare su apex flow.  
4. Runbook DNS/Auth.  
5. Smoke e2e: demo + un company creato via onboarding (Ambrosia reale quando in sessione).  
6. **Skip** UI piani/gating.

## Acceptance criteria

- [ ] `slug.skibidiorders.com` e `/r/slug` risolvono lo stesso locale
- [ ] Apex spiega Skibidi e manda alla demo inventata (flag esempio)
- [ ] Nessun hardcode Ambrosia; Ambrosia esiste solo se creata via onboarding
- [ ] Nessun lucchetto “piano free vs business” in UI
- [ ] Runbook aggiornato
- [ ] Sessione onboarding Ambrosia fattibile end-to-end su subdomain reale

## Rischi / note

- Prefisso `/r` obbligatorio per non rompere route app.
- Non vendere “piani” in UI finché non c’è pagamento.
- Native resta un company per build.
