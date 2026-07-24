<!-- @format -->

# Fase 01 — Schema branding + BrandProvider

## Obiettivo

Creare il canale dati per-tenant: tipi `CompanyBranding`, `BrandProvider` / `useBrand()`, seed del **locale demo Skibidi** (fantasy) su `*.skibidiorders.com`, senza logo Ambrosia. La UI può ancora avere hardcode finché non arriva la fase 02, ma il runtime già legge dal DB.

## Fuori scope

- Ripulire UI Ambrosia (fase 02)
- Wizard onboarding (fase 03)
- Upload immagini admin (fase 04)
- Path `/r/[slug]` (fase 05)

## Prerequisiti

- `companies` + `TenantContext` + RLS già attivi
- Ops in `companies.settings` (`checkoutLanguage`, `deliveryFeeEur`, `orderCapacity`, `alerts`)

## Decisioni fissate (da Q&A)

| Tema | Decisione |
|------|-----------|
| Nome locale | **`companies.name`** è la source of truth (es. “Pizzeria Da Mario”). In lettura UI: `branding` usa quel nome (mirror/allineamento). |
| Demo | Tenant inventato **Skibidi** (nome fantasy + colori inventati piattaforma), non branding Ambrosia hardcoded |
| Logo Ambrosia | **Abbandonato** — seed demo senza PNG Ambrosia |
| URL | Subdomain `slug.skibidiorders.com` (es. `pizzeria-da-mario.skibidiorders.com`) |
| Orari | Il ristoratore li inserirà (fasi 03/04). In schema: **non duplicare** una seconda lista “marketing”. La landing leggerà `orderCapacity.businessHours` (o helper condiviso). In `CompanyBranding` **non** teniamo `hours[]` / `openingHoursLabel` come seconda verità — al massimo un formatter UI. |

### Chiarimento “source of truth”

Significa: se cambi il nome del locale, lo cambi in **un posto** (`companies.name`). Non esistono due nomi diversi (DB vs branding) che possono divergere. `settings.branding` può omettere `name` e il provider lo riempie da `companies.name`.

### Chiarimento orari

Un solo posto dove il ristoratore setta Mar–Dom / fasce. Quella lista:
- decide se si accettano ordini (`AppSettingsContext`)
- viene formattata in landing/footer

Niente “orari belli per il sito” separati dagli “orari veri”.

## Contratto dati / API

### `CompanyBranding` — `lib/types/branding.ts`

```ts
export type CompanyBranding = {
  onboardingCompleted: boolean;
  /** true = locale demo piattaforma (“ristorante di esempio”) */
  isDemo: boolean;
  tagline: string;
  description: string;
  story: string;
  logoUrl: string | null;
  colors: {
    primary: string;
    primaryForeground: string;
    background: string;
    accent: string;
    foreground: string;
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
  social: {
    facebook?: string;
    facebookLabel?: string;
    instagram?: string;
  };
  media: {
    heroImageUrl: string | null;
    galleryImageUrls: string[]; // target ≥5 in fase 04; seed demo può partire con 3–5 URL web
  };
  seo: {
    titleTemplate: string; // es. "{name} | Ordina online"
    description: string;
    ogImageUrl: string | null;
  };
};
```

Nome display: `companies.name` (non campo branding obbligatorio).

### Palette fallback piattaforma (inventata — demo Skibidi)

Usare come default neutro / seed demo (non Ambrosia):

| Token | Hex | Ruolo |
|-------|-----|--------|
| primary | `#1F4B3A` | verde scuro “locale / fresco” |
| primaryForeground | `#FFFFFF` | testo su CTA |
| background | `#F4F7F5` | fondo chiaro |
| accent | `#E8A838` | accent caldo (cibo) |
| foreground | `#14201C` | testo |

Nome demo seed: **`Skibidi Kitchen`** (fantasy).  
Slug demo: **`demo`** → `demo.skibidiorders.com` (o fallback localhost → questo company id).  
Tagline es.: “Ordina. Ritira. A tavola.”  
`isDemo: true`, `onboardingCompleted: true`.

### Persistenza

- `companies.settings.branding`
- Merge non distruttivo con ops keys
- `AppSettingsContext` **deve** preservare `branding` su ogni save

### API — `BrandProvider` separato (scelta)

Nested sotto `TenantProvider` in `app/_layout.tsx`:

```ts
type BrandContextValue = {
  companyId: string | null;
  companySlug: string | null;
  companyName: string;       // da companies.name
  branding: CompanyBranding; // sempre completo (parser + fallback)
  businessHours: WeeklyBusinessHours; // da settings.orderCapacity (stessa fonte ops)
  isLoading: boolean;
  isBrandingComplete: boolean;
  refreshBranding: () => Promise<void>;
};
```

Query resolve:

```ts
.select('id, name, slug, settings')
.eq('slug', slug)
.eq('active', true)
.single()
```

### Seed SQL

- Upsert/update company demo Skibidi (slug `demo`, `isDemo`, colori tabella sopra, media URL Unsplash/placeholder cibo)
- **Non** migrare logo Ambrosia
- Ambrosia come cliente reale arriverà via onboarding (fase 03), non come brand nel codice

Opzione: tenere UUID fallback attuale come company demo, rinominandola a Skibidi Kitchen in migration (evita rompere `EXPO_PUBLIC_COMPANY_ID` / seed locali). Documentare lo switch nel file migration.

## File toccati

| Path | Azione |
|------|--------|
| `lib/types/branding.ts` | Tipi + `parseCompanyBranding` + `PLATFORM_BRANDING_FALLBACK` |
| `lib/stores/BrandContext.tsx` | Provider + `useBrand` |
| `app/_layout.tsx` | Wrap `BrandProvider` |
| `lib/stores/AppSettingsContext.tsx` | Merge settings preservando `branding` |
| `lib/stores/TenantContext.tsx` | Select `name, slug, settings` (o delega load a Brand) |
| `supabase/migrations/…_skibidi_demo_branding.sql` | Seed demo |
| `lib/data/brand.ts` | Deprecato; non più source of truth |

## Step di implementazione

1. Tipi + parser difensivo + palette/fallback Skibidi.
2. `BrandProvider` / `useBrand` + ore da `orderCapacity.businessHours`.
3. Fix merge in `AppSettingsContext`.
4. Migration seed demo (`isDemo: true`, no logo Ambrosia).
5. Smoke: localhost → `companyName === 'Skibidi Kitchen'`, colori seed; settings ops save non cancella branding.

## Acceptance criteria

- [ ] `useBrand()` sempre definito sotto root layout
- [ ] Demo seed in DB con branding Skibidi + `isDemo`
- [ ] Nessun riferimento runtime obbligatorio al logo Ambrosia bundlato
- [ ] Save ops non wipe-a `branding`
- [ ] Resolve subdomain/env/fallback invariato funzionalmente
- [ ] Orari esposti da unica fonte ops, non da lista branding duplicata

## Rischi / note

- Rinominare la company fallback può sorprendere ambienti con dati Ambrosia già in DB: migration deve essere esplicita (rename + branding patch).
- Immagini seed: URL esterni stabili (Unsplash) ok per demo; poi Storage in fase 04.
- Native senza `EXPO_PUBLIC_COMPANY_ID`: warning già esistente.
