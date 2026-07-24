<!-- @format -->

# Fase 04 — Admin Identità & Landing

## Obiettivo

Dare all’admin un pannello per modificare branding e contenuti landing **dopo** l’onboarding (logo, colori, copy, gallery, SEO, contatti), con salvataggio su `companies.settings.branding` e preview coerente con la UI pubblica.

## Fuori scope

- CMS a blocchi / drag-and-drop sezioni
- A/B testing landing
- Custom CSS arbitrario del tenant
- Path slug / custom domain (fase 05)

## Prerequisiti

- Fase 01–03: branding tipizzato, UI dinamica, company creata via onboarding
- Storage Supabase disponibile (o da abilitare) per upload immagini

## Contratto dati / API

### Sezioni UI admin

1. **Identità** — name (sync `companies.name`), tagline, description, story
2. **Tema** — color pickers (`primary`, `background`, `accent`, `foreground`, `primaryForeground`)
3. **Logo & media** — upload logo, hero, gallery (max N immagini)
4. **Contatti & social** — address, phone, whatsapp, maps, vat, facebook/instagram
5. **Orari display** — `openingHoursLabel` + lista `hours[]` (display landing; ops capacity resta in admin-options esistente)
6. **SEO** — titleTemplate, description, ogImageUrl

### Persistenza

```ts
// merge
settings = {
  ...existingSettings,
  branding: { ...existingBranding, ...patch, onboardingCompleted: true },
}
await supabase.from('companies').update({ name, settings }).eq('id', companyId)
```

- Aggiornare anche colonna `companies.name` quando cambia nome commerciale
- Dopo save: `refreshBranding()`

### Storage

- Bucket proposto: `company-assets` (public read)
- Path: `{company_id}/logo.{ext}`, `{company_id}/hero.{ext}`, `{company_id}/gallery/{uuid}.{ext}`
- Policy: upload/delete solo admin con `get_my_company_id() = company_id`

### Preview

- Pannello “Anteprima landing” (WebView web / screen read-only) oppure link “Apri sito” su subdomain
- Preview deve riflettere colori CSS vars subito dopo save

## File toccati

| Path | Azione |
|------|--------|
| `app/admin-branding.tsx` (nuovo) o sezione in `app/admin-options.tsx` | Schermata Identità & Landing |
| `components/features/admin/BrandingForm.tsx` (nuovo) | Form sezioni |
| `components/features/admin/ColorField.tsx` (nuovo) | Picker colore |
| `lib/api/companyAssets.ts` (nuovo) | Upload/delete Storage |
| `lib/stores/BrandContext.tsx` | `updateBranding(patch)` helper |
| `app/(tabs)/_layout.tsx` / navigazione admin | Voce menu “Identità” |
| `supabase/migrations/…_company_assets_bucket.sql` | Bucket + RLS storage |

## Step di implementazione

1. Aggiungere route/voce admin “Identità & Landing”.
2. Form controllato bindato a `useBrand().branding`.
3. Save merge + update `companies.name`.
4. Upload logo/hero/gallery con preview locale.
5. Validazione URL/colori hex.
6. Preview o deep-link post-save.
7. QA: modifica colore → landing header/CTA aggiornati senza reload hard (web).

## Acceptance criteria

- [ ] Admin può cambiare nome, tagline, colori, contatti e vedere il risultato su landing
- [ ] Upload logo sostituisce `branding.logoUrl` e compare in header
- [ ] Gallery URLs salvate in `branding.media.galleryImageUrls` e usate da `LandingSections`
- [ ] Admin di company A non può scrivere asset/settings di company B
- [ ] Salvataggio non cancella `deliveryFeeEur` / `orderCapacity` / `alerts`
- [ ] Campi SEO aggiornano Head/title dove supportato

## Rischi / note

- Non duplicare “orari operativi” di `admin-options` (capacity): qui solo **copy display** landing, oppure sync esplicita documentata se si sceglie un’unica source.
- Immagini pesanti: limitare size/client-side resize.
- Evitare editor rich-text complesso in v1 (textarea plain).
- Su native, color picker può essere input hex se manca libreria già in repo.
