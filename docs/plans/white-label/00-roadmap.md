<!-- @format -->

# White-Label SaaS — Roadmap

> Documenti di planning versionati. Implementare una fase alla volta, in ordine.
> Aggiornato con decisioni prodotto (2026-07-24).

## Visione

Trasformare Skibidi Orders da app **single-brand hardcodata (Ambrosia)** a piattaforma **SaaS multi-tenant white-label**: un solo deploy su `*.skibidiorders.com`, tanti locali, UI/landing/home personalizzate dai dati raccolti in onboarding.

## Decisioni prodotto fissate

| Decisione | Scelta |
|-----------|--------|
| Primo cliente reale | **Pizzeria Ambrosia** — onboarding fatto **insieme** al ristoratore (presentazione prodotto + setup guidato) |
| Demo piattaforma | Tenant **inventato** “Skibidi” (fantasy, anche stile burger/demo) con flag “ristorante di esempio” — è ciò che si vede sull’apex per spiegare il prodotto |
| Logo Ambrosia in codice | **Abbandonato** — niente PNG bundlato come brand runtime |
| Target v1 | Pizzerie **asporto + tavoli**; menu personalizzabile (poi hamburger/altri senza riscrivere tutto) |
| Dominio | Apex / wildcard: **`*.skibidiorders.com`** (es. `pizzeria-da-mario.skibidiorders.com`) |
| Verticalità UI | Per ora **pizza-centrica**; in futuro sezioni per non-pizzerie |
| Self-serve | Sì: dopo aver visitato la demo, l’utente decide di creare la propria company |
| Go-live | Non “100% on” finché non completa checklist prossimi passi |

## Stato attuale (baseline)

| Area | Stato |
|------|--------|
| Isolamento dati | **Già presente**: `companies` + `company_id` + RLS |
| Resolve tenant | **Già presente**: env → subdomain slug → fallback in [`TenantContext.tsx`](../../../lib/stores/TenantContext.tsx) |
| Ops settings | **Già presente**: fee, orari capacity, alert in `companies.settings` |
| Branding / tema | **Hardcodato** Ambrosia — da rimuovere |
| Onboarding self-service | **Assente** |
| Admin branding | **Assente** |

## Default tecnici (fissati)

1. Nome commerciale: colonna **`companies.name`** (source of truth); `branding` ripete/allinea per copy UI.
2. Branding in **`companies.settings.branding`** (JSONB, niente tabella dedicata v1).
3. **Orari = una sola fonte** (ops `businessHours`) che alimenta anche la landing — il ristoratore li inserisce una volta.
4. Tenant URL: **subdomain** `slug.skibidiorders.com`; path `/r/[slug]` solo in fase 05 come backup anti-collisione.
5. Ordine implementazione: **01 → 02 → 03 → 04 → 05**.

## Fasi

| Fase | File | Deliverable |
|------|------|-------------|
| 01 | [01-schema-brand-provider.md](./01-schema-brand-provider.md) | Schema branding + `useBrand` + seed **demo Skibidi** (non Ambrosia logo) |
| 02 | [02-depersonalize-ui.md](./02-depersonalize-ui.md) | Tolto hardcode Ambrosia ovunque; landing struttura fissa + dati dinamici; menu demo con immagini web |
| 03 | [03-onboarding-wizard.md](./03-onboarding-wizard.md) | Wizard self-serve dopo demo; company on-demand; home + checklist post go-live |
| 04 | [04-admin-branding.md](./04-admin-branding.md) | Schermata dedicata Identità & Landing; gallery ≥5; orari unificati |
| 05 | [05-saas-hardening.md](./05-saas-hardening.md) | Path `/r/[slug]`, apex marketing, runbook DNS; niente gating piani complesso in v1 |

## Dipendenze

```text
01 Schema + BrandProvider
 ├──► 02 Depersonalize UI (+ menu demo)
 └──► 03 Onboarding (dopo che la demo/UI già parla branding)
         └──► 04 Admin branding
                 └──► 05 Hardening
```

## Fuori scope (per ora)

- Billing / Stripe / lock feature per piano
- Chiedere “tipo attività” in onboarding
- Legal personalizzati per-tenant
- White-label store Apple/Google automatico
- Custom domain cliente
- Landing diversa per hamburger (stessa struttura pizza-centrica finché non si amplia)

## Come usare questi MD

1. Aprire il file della fase corrente.
2. Implementare fino agli acceptance criteria.
3. Solo dopo passare alla successiva.
