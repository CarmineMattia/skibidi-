<!-- @format -->

# Fase 04 — Admin Identità & Landing

## Obiettivo

Schermata **dedicata** (semplice, “boomer-friendly”) per far modificare al ristoratore identità, colori, foto e contatti dopo l’onboarding. Orari **unificati** (stessi che guidano ordini e landing). Gallery **almeno 5 immagini**.

## Fuori scope

- CMS a blocchi / drag-and-drop
- Custom CSS
- Ruolo staff “solo copy” (previsto, non in v1 — solo nota design)
- Path slug / custom domain

## Prerequisiti

- Fasi 01–03: branding dinamico, UI, company creata, checklist

## Decisioni fissate (da Q&A)

| Tema | Decisione |
|------|-----------|
| UI | **Schermata dedicata** `admin-branding` (non sepolta in options) |
| Gallery | **Minimo 5** slot immagini (hero conta separato o come #1 — **scelta:** 1 hero + fino a 5 gallery) |
| Orari | **Una sola fonte** `businessHours` → ops + landing |
| Preview | Niente iframe complesso: bottone **“Vedi il sito pubblico”** che apre `https://{slug}.skibidiorders.com` |
| Staff non-admin | **Futuro**: potranno editare solo copy; v1 = solo `admin` |

### Chiarimento “preview”

Non serve una mini-landing dentro l’admin. Basta un bottone grande: apre il sito vero del locale così il ristoratore vede nome, colori e foto come i clienti.

## Contratto dati / API

### Sezioni schermata (ordine UI semplice)

1. **Nome e testi** — `companies.name`, tagline, description, story  
2. **Colori** — primary (+ accent opzionale); altri derivati/default  
3. **Foto** — logo, hero, gallery (5 slot, upload o URL)  
4. **Contatti** — address, phone, whatsapp, social, vat  
5. **Orari** — stesso editor di admin-options / capacity (componente condiviso); salva in `orderCapacity.businessHours`  
6. **SEO base** — titleTemplate, description (opzionale, default da name)  
7. CTA fissa in alto: **Vedi il sito pubblico**

### Persistenza

```ts
await supabase.from('companies').update({
  name,
  settings: {
    ...existing,
    branding: { ...existing.branding, ...patch },
    orderCapacity: { ...existing.orderCapacity, businessHours },
  },
}).eq('id', companyId)
```

Poi `refreshBranding()`.

### Storage

- Bucket `company-assets`, public read  
- Path `{company_id}/logo`, `hero`, `gallery/{n}`  
- RLS: solo admin della company  
- Limite size + resize client (es. max 1.5MB, lato lungo 1600px)

### Permessi v1 vs futuro

```text
v1: role === 'admin' && company_id match
v2: role staff + permission 'edit_branding_copy' (solo testi, no colori/slug)
```

Non implementare v2 ora; non disegnare UI che lo impedisca dopo (sezioni Testi vs Tema separate aiutano).

## File toccati

| Path | Azione |
|------|--------|
| `app/admin-branding.tsx` | Schermata dedicata |
| `components/features/admin/BrandingForm.tsx` | Form a sezioni |
| `components/features/admin/ColorField.tsx` | Input hex + swatch |
| `components/features/admin/GallerySlots.tsx` | 5 slot |
| `lib/api/companyAssets.ts` | Upload |
| `lib/stores/BrandContext.tsx` | `updateBranding` |
| Navigazione admin | Voce chiara “Identità e sito” |
| Migration storage bucket | RLS |

Condividere editor orari con `admin-options` (estrarre componente se duplicato).

## Step di implementazione

1. Route + voce menu admin grande e chiara.
2. Form sezioni 1–6 + bottone sito pubblico.
3. Upload logo/hero/gallery (5).
4. Orari via componente condiviso → `businessHours`.
5. Validazione hex / campi telefono.
6. QA: cambio colore → sito pubblico aggiornato dopo refresh branding.

## Acceptance criteria

- [ ] Admin boomer-path: trova “Identità e sito”, cambia nome/colore/foto, apre sito e vede le modifiche
- [ ] Gallery supporta 5 immagini; landing le mostra
- [ ] Orari cambiati qui = orari landing = regole accettazione ordini
- [ ] Merge settings non cancella fee/alert
- [ ] Solo admin della company può uploadare
- [ ] Bottone “Vedi il sito pubblico” funziona su web

## Rischi / note

- Non duplicare due editor orari divergenti.
- Foto pesanti: resize obbligatorio.
- Testi plain textarea (no rich text).
