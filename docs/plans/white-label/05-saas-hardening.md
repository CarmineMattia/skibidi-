<!-- @format -->

# Fase 05 — Hardening SaaS

## Obiettivo

Chiudere i gap operativi multi-tenant dopo che branding + onboarding + admin funzionano: resolve tenant più robusto (path slug), piani, checklist DNS/deploy, e feature flag per verticalità prodotto (es. pizza builder non universale).

## Fuori scope

- Marketplace plugin
- Multi-region DB
- White-label store listing automatico (Apple/Google) per ogni tenant
- Fatturazione SaaS completa (oltre hook plan)

## Prerequisiti

- Fasi 01–04 operative in staging
- Wildcard DNS / hosting già previsti in `DEPLOYMENT-STRATEGY.md`

## Contratto dati / API

### 1. Path-based tenant resolve (oltre subdomain)

Supportare:

- `slug.skibidiorders.com` (già)
- `skibidiorders.com/r/[slug]` o `skibidiorders.com/[slug]` (nuovo)

Estendere [`lib/stores/TenantContext.tsx`](../../../lib/stores/TenantContext.tsx):

1. `EXPO_PUBLIC_COMPANY_ID`
2. Subdomain slug
3. Path slug (web)
4. Dev fallback

Documentare precedenza. Utile per preview e ambienti senza wildcard DNS.

### 2. Piani `companies.plan`

Valori iniziali: `free` | `starter` | `business` (allineare a docs esistenti).

Gate soft (feature flags da plan):

| Feature | free | starter | business |
|---------|------|---------|----------|
| Ordini online | sì | sì | sì |
| Branding base | sì | sì | sì |
| Custom gallery / SEO avanzato | no | sì | sì |
| Alert sound custom | no | sì | sì |
| Multi-kiosk / priorità support | no | no | sì |

Implementazione: helper `useCompanyPlan()` + check in UI admin (non enforcement fiscale).

### 3. Feature flags verticali

In `settings.features` (accanto a branding):

```ts
{
  pizzaBuilder: boolean;
  doughBallTracking: boolean;
  tableOrdering: boolean;
  delivery: boolean;
}
```

Default onboarding: tutti `true` per pizzerie; UI nasconde pizza builder se `false`.

File tipici da gattare: `components/features/PizzaBuilderModal.tsx`, entry point home/menu, `lib/data/pizzaBuilder.ts` assumptions.

### 4. DNS & deploy checklist (doc)

Aggiornare / creare runbook in `docs/plans/white-label/` o `DEPLOYMENT-STRATEGY.md`:

1. Wildcard `*.skibidiorders.com` → hosting
2. Supabase Auth redirect URLs wildcard
3. Nuovo tenant: onboarding self-service (path primario)
4. Native: EAS profile con `EXPO_PUBLIC_COMPANY_ID`
5. Smoke: slug resolve, landing brand, create order, kitchen

### 5. Marketing root

Dominio apex senza tenant: landing piattaforma (prodotto Skibidi), non Ambrosia e non fallback company seed.

## File toccati

| Path | Azione |
|------|--------|
| `lib/stores/TenantContext.tsx` | Path slug resolve |
| `app/r/[slug]/_layout.tsx` o rewrite | Route path-based |
| `lib/types/companyPlan.ts` / features | Tipi plan + features |
| `lib/stores/BrandContext.tsx` o AppSettings | Esporre features |
| `components/features/PizzaBuilderModal.tsx` + entry points | Gate `features.pizzaBuilder` |
| `DEPLOYMENT-STRATEGY.md` | Allineare a self-service + path slug |
| `docs/plans/white-label/00-roadmap.md` | Marcare fase 05 done quando chiusa |

## Step di implementazione

1. Path slug resolve + route Expo Router.
2. Landing apex piattaforma (no seed Ambrosia).
3. `settings.features` + default onboarding.
4. Nascondere pizza builder / dough tracking se flag off.
5. `useCompanyPlan` + gate soft sezioni admin branding avanzate.
6. Aggiornare runbook deploy / Auth redirects.
7. Test e2e smoke multi-tenant (due company seed).

## Acceptance criteria

- [ ] Tenant resolve funziona da subdomain **e** da path slug
- [ ] Apex domain non mostra branding Ambrosia
- [ ] Company con `pizzaBuilder: false` non vede entry “componi pizza”
- [ ] Plan `free` nasconde (UI) feature business documentate
- [ ] Runbook deploy aggiornato e coerente col codice
- [ ] Due tenant in parallelo: dati e branding isolati (smoke test)

## Rischi / note

- Path slug può collidere con route app esistenti (`login`, `offers`, …): preferire prefisso `/r/[slug]`.
- Plan gating è **soft** finché non c’è billing: non fingere sicurezza client-side.
- Non rimuovere pizza domain dal codebase: solo flag.
- Documentare che native resta single-company-per-build.
