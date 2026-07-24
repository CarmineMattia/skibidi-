<!-- @format -->

# Fase 02 — Depersonalizzare UI (consumare useBrand)

## Obiettivo

Togliere tutta la personalizzazione Ambrosia dal codice (landing, home, kitchen, admin copy, legal, SEO, receipt). L’app mostra il **tenant corrente** (demo Skibidi o company reale) via `useBrand()` + CSS variables. Menu di fantasia con immagini da URL web per prodotti/combo demo.

## Fuori scope

- Wizard onboarding (fase 03)
- Upload admin gallery (fase 04) — qui bastano URL già in seed
- Landing diversa per hamburger (resta struttura pizza-centrica)
- Legal custom per-tenant

## Prerequisiti

- Fase 01: `useBrand()`, seed demo Skibidi, merge settings ok

## Decisioni fissate (da Q&A)

| Tema | Decisione |
|------|-----------|
| Scope ripulitura | **Tutta l’app**, inclusa kitchen/admin: via stringhe/hex Ambrosia |
| Menu | Menu **fantasy** demo + immagini online (anche combo) |
| Legal | Template **generici** (nome/vat da brand dove serve un contatto; niente testi legali unici per locale) |
| Landing | **Stessa struttura** Ambrosia attuale (header/hero/story/gallery/contact/footer); cambiano solo nome, colori, immagini, copy |
| Verticalità | **Pizza-centrica** per ora |
| SEO | **Mix**: shell generica dove serve (`+html` statico ok) + **Head/JSON-LD tenant-aware** lato client (obbligatorio con più locali) |

## Contratto dati / API

### Mapping

| Legacy | Nuovo |
|--------|--------|
| `BRAND.*` / `BRAND_LOGO` | `useBrand()` — logo da `logoUrl` o monogramma da `companyName` |
| Hex `#8d171e` / cream Ambrosia | CSS vars da `branding.colors` (web) + hook colori (native) |
| “Ambrosia” in titoli | `companyName` |
| `BRAND.deliveryFee` | `useAppSettings().deliveryFee` |
| Orari landing | Formatter su `businessHours` da `useBrand()` / settings |
| Flag demo | Se `branding.isDemo` → banner “Ristorante di esempio” |

### Landing — struttura fissa (sezioni)

1. Header (logo/nome/tagline/CTA)
2. Hero (immagine + description + CTA ordina)
3. Story / “chi siamo”
4. Gallery (da `media.galleryImageUrls`; se vuota, nascondi sezione)
5. Contatti + orari formattati
6. Footer + link legal generici

### SEO mix (scelta concreta)

- `app/+html.tsx`: title/description **generici piattaforma** (“Skibidi Orders”) + theme-color default
- Per-route `Head` / schema.org su landing tenant: `companyName`, address, phone, `seo.*` — aggiornato client-side quando branding è loaded
- Obiettivo: con N pizzerie, condividere un link subdomain dà meta coerenti il più possibile; accettare limite SSR Expo dove non c’è branding a build time

### Menu demo

- Seed prodotti/categorie fantasy legati al company demo (SQL o script)
- `image_url` = URL pubblici cibo (Unsplash/similar)
- Combo incluse con immagini
- Non riusare testi “Ambrosia” / Montecchio

## File toccati

### Consumer `BRAND` (migrare tutti)

`LandingHeader`, `LandingHero`, `LandingSections`, `LandingFooter`, `LegalDocumentScreen`, `app/(tabs)/index.tsx`, `app/+html.tsx`, `login`, `offers`, `privacy`, `cookie`, `termini`, `allergeni`, `modal`, `DigitalReceipt`, `lib/print/orderPrint.ts`

### Copy/hex Ambrosia (ripulire)

Home guest/actions/offers/grid, `account`, `rewards`, `order-tracking`, `two`, `admin-options`, kitchen UI se compare “Ambrosia”, `tests/landing.spec.ts`

### Tokens / asset

- `global.css` / `constants/Colors.ts` → default = palette Skibidi fase 01
- Rimuovere uso runtime `assets/images/logo-pizzeria-ambrosia.png`
- Landing images → URL da `branding.media` (seed), non JPEG Ambrosia bundlati come source of truth

### Cleanup

- `lib/data/brand.ts` → solo fixture test/seed o eliminato

## Step di implementazione

1. `BrandLogo` + inject CSS vars in `BrandProvider`.
2. Banner `isDemo` su landing/home.
3. Migrare landing intera alla struttura fissa + dati dinamici.
4. Legal generici con `{name}` contatto da brand.
5. SEO mix (`+html` generico + Head tenant).
6. Ripulire home/kitchen/admin stringhe e hex.
7. Seed menu fantasy + immagini URL.
8. Receipt/print da branding/contact.
9. Aggiornare test landing (assert su Skibidi demo o selettori neutri).
10. Grep zero Ambrosia/`#8d171e` / import `brand.ts` in app runtime.

## Acceptance criteria

- [ ] Nessun import runtime `lib/data/brand` / `BRAND_LOGO`
- [ ] Nessuna stringa “Ambrosia” o hex Ambrosia in `app/` e `components/` (salvo commenti docs)
- [ ] Demo tenant: landing struttura Ambrosia-like ma branding Skibidi + banner esempio
- [ ] Gallery vuota → sezione nascosta
- [ ] Orari landing = stessi di ops capacity
- [ ] Menu demo con immagini URL visibili
- [ ] Test landing verdi

## Rischi / note

- Hex Ambrosia sparsi: fare passata `rg` sistematica.
- URL immagini esterne: hotlink può rompersi — accettabile per demo; poi Storage.
- Non cambiare layout landing: solo dati.
