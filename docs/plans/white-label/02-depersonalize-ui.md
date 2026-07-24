<!-- @format -->

# Fase 02 — Depersonalizzare UI (consumare useBrand)

## Obiettivo

Rimuovere la personalizzazione Ambrosia hardcodata da landing, home, legal, SEO, login, receipt/print e sostituirla con `useBrand()` / CSS variables tenant. L’app deve apparire generica o tenant-specific in base ai dati branding, non al codice.

## Fuori scope

- Wizard onboarding (fase 03)
- Editor admin branding / upload (fase 04)
- Feature-flag pizza builder come prodotto generico (fase 05)
- Cambiare `app.json` name per ogni tenant nativo (limite Expo; resta build-time)

## Prerequisiti

- Fase 01 completata: `useBrand()`, seed Ambrosia, fallback piattaforma

## Contratto dati / API

### Mapping obbligatorio `BRAND` → `useBrand()`

| Campo legacy (`lib/data/brand.ts`) | Nuovo |
|------------------------------------|--------|
| `BRAND.name` | `branding.name` |
| `BRAND.tagline` | `branding.tagline` |
| `BRAND.description` / `story` | `branding.description` / `story` |
| address/phone/vat/social/hours | `branding.contact.*`, `social`, `hours`, `openingHoursLabel` |
| `BRAND.deliveryFee` | **non branding**: usare `useAppSettings().deliveryFee` (già dinamico) |
| `BRAND_LOGO` | `branding.logoUrl` (Image URI) o placeholder |

### Colori

- Iniettare su web CSS variables da `branding.colors` (es. `--brand-primary`) in un effetto del `BrandProvider`
- Preferire token Tailwind/semantic già in `global.css` dove possibile; eliminare hex `#8d171e` / `#f9ecdd` sparsi nei componenti consumer pubblici
- Native: esporre `colors` da hook e usarli inline dove serve (niente CSS vars)

### SEO

- [`app/+html.tsx`](../../../app/+html.tsx) e Head in [`app/(tabs)/index.tsx`](../../../app/(tabs)/index.tsx): title/description/og/schema da `branding.seo` + contact (niente “Montecchio Emilia” hardcoded)

## File toccati

### Consumer diretti di `BRAND` / `BRAND_LOGO` (da migrare)

| Path |
|------|
| `components/features/landing/LandingHeader.tsx` |
| `components/features/landing/LandingHero.tsx` |
| `components/features/landing/LandingSections.tsx` |
| `components/features/landing/LandingFooter.tsx` |
| `components/features/landing/LegalDocumentScreen.tsx` |
| `app/(tabs)/index.tsx` |
| `app/+html.tsx` |
| `app/login.tsx` |
| `app/offers.tsx` |
| `app/privacy.tsx` |
| `app/cookie.tsx` |
| `app/termini.tsx` |
| `app/allergeni.tsx` |
| `app/modal.tsx` |
| `components/features/DigitalReceipt.tsx` |
| `lib/print/orderPrint.ts` |

### Copy / hex Ambrosia senza import BRAND (da ripulire)

| Path | Esempio |
|------|---------|
| `components/features/home/HomeGuestHero.tsx` | CTA/colori pizza-centric + `#8d171e` |
| `components/features/home/HomePrimaryActions.tsx` | hex Ambrosia |
| `components/features/home/HomeQuickActions.tsx` | hex Ambrosia |
| `components/features/home/HomeOffersSection.tsx` | hex Ambrosia |
| `components/features/home/HomeCategoryGrid.tsx` | hex Ambrosia |
| `app/(tabs)/account.tsx` | “Account Ambrosia” |
| `app/rewards.tsx` | “Ambrosia Club” |
| `app/(tabs)/order-tracking.tsx` | title Ambrosia |
| `app/(tabs)/two.tsx` | “Cliente Ambrosia” |
| `app/admin-options.tsx` | “Suono predefinito Ambrosia” |
| `tests/landing.spec.ts` | rename describe / assert generici o seed-aware |

### Asset

| Path | Azione |
|------|--------|
| `assets/images/logo-pizzeria-ambrosia.png` | Non importare più in UI; seed usa URL |
| `assets/images/landing/*.jpeg` | Landing usa `branding.media.*`; asset Ambrosia solo seed/demo Storage |

### Design tokens

| Path | Azione |
|------|--------|
| `global.css` | Variabili default = palette piattaforma neutra; override runtime da BrandProvider |
| `constants/Colors.ts` | Default neutri; commento Ambrosia rimosso |

### Cleanup finale

| Path | Azione |
|------|--------|
| `lib/data/brand.ts` | Rimuovere o ridurre a fixture test/seed only |

## Step di implementazione

1. Helper `BrandLogo` / `useBrandColors()` per Image URI + fallback testo.
2. Web: inject CSS vars in `BrandProvider` all’aggiornamento branding.
3. Migrare landing (header → hero → sections → footer) a `useBrand`.
4. Migrare legal screens + `LegalDocumentScreen`.
5. Migrare SEO (`+html`, index Head, JSON-LD).
6. Migrare login, offers, receipt, print.
7. Sostituire stringhe “Ambrosia” residue e hex primari nei componenti home/account/rewards/tracking.
8. Aggiornare `tests/landing.spec.ts` su seed o asserzioni neutre.
9. Eliminare import runtime di `lib/data/brand.ts` (grep zero fuori seed/test).

## Acceptance criteria

- [ ] `rg "from '@/lib/data/brand'|BRAND_LOGO" --glob '!docs/**'` → zero (o solo seed/test espliciti)
- [ ] `rg "Ambrosia|#8d171e" --glob '{app,components}/**/*.{ts,tsx}'` → zero (o solo commenti seed documentati)
- [ ] Landing su tenant seed Ambrosia mostra ancora nome/logo/colori Ambrosia (da DB)
- [ ] Tenant senza branding mostra fallback neutro (nome generico, colori piattaforma)
- [ ] Receipt/print usano `branding.name/address/phone/vat`
- [ ] Test landing aggiornati e verdi

## Rischi / note

- `app/+html.tsx` gira in contesto statico: verificare se branding runtime è disponibile; se no, SEO minimale generico + override client dove Expo Router Head lo permette.
- Hex Ambrosia sono diffusissimi: priorità ai **surface customer-facing**; admin interno può restare token semantic in un secondo passaggio se troppo ampio, ma i file listati sopra sono in scope.
- Non spezzare layout landing: stesso markup, dati dinamici.
- `deliveryFee` display: formattare da `useAppSettings`, non da branding.
