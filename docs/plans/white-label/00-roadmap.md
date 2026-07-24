<!-- @format -->

# White-Label SaaS — Roadmap

> Documenti di planning versionati. Implementare una fase alla volta, in ordine.

## Visione

Trasformare Skibidi Orders da app **single-brand (Pizzeria Ambrosia)** a piattaforma **SaaS multi-tenant white-label**: un solo deploy, tanti locali, UI/landing/home personalizzate dai dati raccolti in onboarding.

## Stato attuale (baseline)

| Area | Stato |
|------|--------|
| Isolamento dati | **Già presente**: `companies` + `company_id` + RLS |
| Resolve tenant | **Già presente**: `EXPO_PUBLIC_COMPANY_ID` → subdomain slug → fallback UUID in [`lib/stores/TenantContext.tsx`](../../../lib/stores/TenantContext.tsx) |
| Ops settings | **Già presente**: `companies.settings` (fee, orari, alert) via [`lib/stores/AppSettingsContext.tsx`](../../../lib/stores/AppSettingsContext.tsx) |
| Branding / tema | **Hardcodato**: [`lib/data/brand.ts`](../../../lib/data/brand.ts), [`global.css`](../../../global.css), [`constants/Colors.ts`](../../../constants/Colors.ts) |
| Onboarding self-service | **Assente** (oggi: SQL + DNS manuale in `DEPLOYMENT-STRATEGY.md`) |
| Admin branding | **Assente** |

## Default strategici (fissati)

1. Ambrosia diventa **tenant seed** nel DB (branding migrato in `settings.branding`), non resta hardcoded nel codice.
2. Branding vive in **`companies.settings.branding`** (estende il JSON già usato; nessuna tabella `brand_profiles` in v1).
3. Tenant resolve resta **subdomain** (`slug.skibidiorders.com`) + env nativo; path slug solo in fase 05.
4. Ordine di implementazione: **01 → 02 → 03 → 04 → 05**.

## Fasi

| Fase | File | Deliverable |
|------|------|-------------|
| 01 | [01-schema-brand-provider.md](./01-schema-brand-provider.md) | Schema branding tipizzato + `BrandProvider` / `useBrand` + seed Ambrosia |
| 02 | [02-depersonalize-ui.md](./02-depersonalize-ui.md) | UI/landing/home/legal/SEO/receipt consumano `useBrand` |
| 03 | [03-onboarding-wizard.md](./03-onboarding-wizard.md) | Wizard self-service crea company + branding minimo |
| 04 | [04-admin-branding.md](./04-admin-branding.md) | Admin Identità & Landing (edit post-onboarding) |
| 05 | [05-saas-hardening.md](./05-saas-hardening.md) | Path slug, plan tiers, DNS, feature flags verticali |

## Dipendenze

```text
01 Schema + BrandProvider
 ├──► 02 Depersonalize UI
 └──► 03 Onboarding (scrive i dati che 01/02 già leggono)
         └──► 04 Admin branding
                 └──► 05 Hardening SaaS
```

Consiglio operativo: completare **01 → 02** prima di **03**, così il wizard scrive su un contratto dati già consumato dalla UI.

## Fuori scope della roadmap (per ora)

- Refactor analytics / export contabilità
- Cambio stack deploy (Vercel/EAS restano)
- White-label nativo automatico (build EAS resta per-company via env)
- Riscrittura stack fiscale Epson
- Multi-lingua completa oltre `it`/`en` checkout già presenti

## Come usare questi MD

1. Aprire il file della fase corrente.
2. Implementare solo quella fase fino agli acceptance criteria.
3. Solo dopo passare alla fase successiva.
