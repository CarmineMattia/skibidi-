<!-- @format -->

# Fase 01 — Schema branding + BrandProvider

## Obiettivo

Definire il contratto dati `companies.settings.branding`, tipizzarlo in TypeScript, caricare branding runtime tramite un `BrandProvider` / hook `useBrand()`, e migrare Ambrosia come **tenant seed** nel DB. Dopo questa fase la UI può ancora usare fallback, ma il canale dati per-tenant esiste.

## Fuori scope

- Sostituire tutti i consumer UI di `BRAND` (fase 02)
- Wizard onboarding (fase 03)
- Upload logo da admin (fase 04)
- Path-based routing (fase 05)

## Prerequisiti

- Multi-tenant già attivo: tabella `companies`, `TenantContext`, RLS
- Ops settings già in `companies.settings` (`checkoutLanguage`, `deliveryFeeEur`, `orderCapacity`, `alerts`)

## Contratto dati / API

### Shape `CompanyBranding` (nuovo modulo tipizzato)

Proposta path: `lib/types/branding.ts` (o `lib/data/brandingSchema.ts`)

```ts
export type CompanyBranding = {
  /** true quando onboarding minimo completato */
  onboardingCompleted: boolean;
  name: string;
  tagline: string;
  description: string;
  story: string;
  logoUrl: string | null;
  colors: {
    primary: string;      // es. #8d171e
    primaryForeground: string;
    background: string;   // es. #f9ecdd / cream
    accent: string;       // es. #e7b577
    foreground: string;   // es. #1c0a0c
  };
  contact: {
    address: string;
    city: string;
    phone: string;
    phoneHref: string;
    whatsappHref: string;
    mapsUrl: string;
    website: string;
    vatNumber: string;
  };
  openingHoursLabel: string;
  hours: Array<{ day: string; hours: string }>;
  social: {
    facebook?: string;
    facebookLabel?: string;
    instagram?: string;
  };
  media: {
    heroImageUrl: string | null;
    galleryImageUrls: string[];
  };
  seo: {
    titleTemplate: string;
    description: string;
    ogImageUrl: string | null;
  };
};
```

### Persistenza

- Chiave JSON: `companies.settings.branding`
- Merge non distruttivo con chiavi ops esistenti (`deliveryFeeEur`, `orderCapacity`, …)
- `companies.name` e `companies.slug` restano colonne top-level (source of truth per nome commerciale / URL); `branding.name` può allinearsi a `companies.name` in lettura

### Flag onboarding

- `settings.branding.onboardingCompleted: boolean`
- Usato dalle fasi 03–04 come gate

### API app

Estendere [`lib/stores/TenantContext.tsx`](../../../lib/stores/TenantContext.tsx) **oppure** aggiungere `BrandProvider` nested:

```ts
type BrandContextValue = {
  companyId: string | null;
  companySlug: string | null;
  companyName: string | null;
  branding: CompanyBranding; // sempre definito (fallback piattaforma se mancante)
  isLoading: boolean;
  isBrandingComplete: boolean; // onboardingCompleted && campi minimi
  refreshBranding: () => Promise<void>;
};
```

Resolve query (web/subdomain):

```ts
.from('companies')
.select('id, name, slug, settings')
.eq('slug', slug)
.eq('active', true)
.single()
```

### Fallback piattaforma (neutro)

Quando `settings.branding` assente o parziale:

- Nome: `companies.name` o `"Il tuo locale"`
- Colori: palette neutra piattaforma (non Ambrosia)
- Logo: null → placeholder tipografico
- Copy: stringhe generiche IT

### Seed Ambrosia

- Migration SQL (o seed script) che fa `UPDATE companies SET settings = settings || jsonb_build_object('branding', …)` per UUID `00000000-0000-0000-0000-000000000001` (o slug Ambrosia esistente)
- Contenuto = valori attuali di [`lib/data/brand.ts`](../../../lib/data/brand.ts) + colori Ambrosia da [`constants/Colors.ts`](../../../constants/Colors.ts)
- Logo: per v1 seed può restare URL pubblico / Storage path; non obbligatorio spostare il PNG bundlato in questa fase

### Deprecazione soft

- `lib/data/brand.ts` resta temporaneamente come **solo seed source / adapter di migrazione**, non come source of truth runtime dopo il provider
- Nessuna rimozione massiva consumer in questa fase (fase 02)

## File toccati

| Path | Azione |
|------|--------|
| `lib/types/branding.ts` (nuovo) | Tipi + `parseCompanyBranding` + `PLATFORM_BRANDING_FALLBACK` |
| `lib/stores/BrandContext.tsx` (nuovo) o estensione `TenantContext.tsx` | Load + expose `useBrand` |
| `app/_layout.tsx` | Wrappare con `BrandProvider` sotto `TenantProvider` |
| `lib/stores/AppSettingsContext.tsx` | Documentare che `settings` ha anche `branding`; evitare overwrite cieco al save ops |
| `supabase/migrations/YYYYMMDDHHMMSS_company_branding_seed.sql` (nuovo) | Seed branding Ambrosia + commento schema |
| `lib/data/brand.ts` | Annotare deprecato / usato solo per seed mapping |

## Step di implementazione

1. Creare tipi `CompanyBranding` + parser difensivo (campi mancanti → fallback).
2. Definire `PLATFORM_BRANDING_FALLBACK` neutro (no Ambrosia).
3. Estendere resolve tenant: `select` include `name, slug, settings`.
4. Implementare `BrandProvider` / `useBrand()` con merge `parseCompanyBranding(settings.branding)`.
5. Aggiornare `AppSettingsContext` save path: merge shallow di `settings` preservando `branding`.
6. Scrivere migration seed Ambrosia con branding completo + `onboardingCompleted: true`.
7. Smoke test: su localhost (fallback company) `useBrand().branding.name` == Ambrosia seed; company senza branding → fallback neutro.

## Acceptance criteria

- [ ] Esiste un tipo TS unico per branding, usato dal provider
- [ ] `useBrand()` disponibile sotto root layout e restituisce sempre un oggetto completo
- [ ] Tenant Ambrosia seed ha `settings.branding` popolato in DB
- [ ] Salvataggio ops settings non cancella `branding`
- [ ] Nessuna regressione resolve `companyId` (subdomain / env / fallback)
- [ ] Codice UI Ambrosia ancora funziona (fase 02 non obbligatoria qui)

## Rischi / note

- **Overwrite settings**: oggi `AppSettingsContext` fa update di `settings` intero; merge obbligatorio.
- **Native**: senza `EXPO_PUBLIC_COMPANY_ID` branding non resolve — comportamento già documentato per tenant.
- **Immagini seed**: URL esterni vs Storage; preferire URL stabili o path Storage `companies/{id}/…`.
- Non introdurre tabella dedicata in v1: JSONB è sufficiente e allineato a ops settings.
