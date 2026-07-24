<!-- @format -->

# Fase 03 — Onboarding self-service ristoratore

## Obiettivo

Permettere a un nuovo ristoratore di registrarsi e configurare in autonomia la propria `company` (slug, branding minimo, contatti/orari), senza SQL manuale. I dati raccolti popolano `companies.settings.branding` e sbloccano la UI già dinamica delle fasi 01–02.

## Fuori scope

- Editor avanzato gallery/SEO (fase 04)
- Billing / Stripe / piani a pagamento (fase 05)
- Seed menu completo automatico (opzionale step light solo)
- Custom domain del cliente

## Prerequisiti

- Fase 01: schema branding + `useBrand` + merge settings sicuro
- Fase 02 consigliata (altrimenti onboarding scrive dati che la UI non mostra ancora)

## Contratto dati / API

### Flusso wizard (step)

1. **Account** — signup email/password → profilo creato come oggi (trigger forza `customer`); poi promozione ad admin della nuova company via RPC
2. **Locale** — `name`, `slug` (validazione unicità + formato `[a-z0-9-]+`)
3. **Identità** — tagline, description breve, colori primary/background (picker semplice), logo opzionale (skip → placeholder)
4. **Contatti** — address, city, phone, vatNumber (opzionale), social opzionali
5. **Orari** — riuso modello `businessHours` già in `AppSettingsContext` / `orderCapacity`
6. **Go-live** — set `branding.onboardingCompleted = true`, redirect admin dashboard / preview landing

### RPC consigliata (security definer)

Nome proposto: `create_company_with_admin`

Input:

```ts
{
  name: string;
  slug: string;
  branding: Partial<CompanyBranding>; // minimo name/tagline/colors/contact
}
```

Comportamento:

1. Auth required (`auth.uid()`)
2. Verifica slug libero
3. `INSERT companies (name, slug, plan, settings, active)`
4. `UPDATE profiles SET role = 'admin', company_id = new_id WHERE id = auth.uid()`
5. Return `{ company_id, slug }`

**Critico**: oggi `handle_new_user()` forza sempre `customer` e non si fida del role client — la promozione admin deve avvenire **solo** in RPC server-side dopo create company.

### RLS

- Policy `INSERT` diretta su `companies` da client: **no** (solo RPC)
- `UPDATE companies` per admin della propria company: già / da verificare in migration `companies_update`
- Storage (se upload logo in step 3): bucket path `companies/{company_id}/logo` con policy company-scoped

### Gate UX

| Ruolo / stato | Comportamento |
|---------------|---------------|
| Admin, `onboardingCompleted === false` | Redirect forzato a `/onboarding` (o modal full-screen) |
| Admin, completed | App normale + admin tabs |
| Customer / guest su tenant esistente | Landing/home branding tenant |
| Root dominio senza slug (marketing) | Landing piattaforma “Skibidi Orders” + CTA “Registra il tuo locale” → onboarding |

### Route proposte

- `app/onboarding/index.tsx` (wizard)
- Entry CTA da login/marketing: “Apri il tuo locale”
- Non riusare `app/login.tsx` Ambrosia-centric: CTA neutra

## File toccati

| Path | Azione |
|------|--------|
| `supabase/migrations/…_create_company_with_admin.sql` | RPC + grants |
| `app/onboarding/index.tsx` (nuovo) | Wizard multi-step |
| `components/features/onboarding/*` (nuovo) | Step UI |
| `lib/api/onboarding.ts` (nuovo) | Client wrapper RPC + validazione slug |
| `app/_layout.tsx` / guard | Redirect admin incompleto → onboarding |
| `app/login.tsx` | CTA “Registra locale” + copy neutro |
| `lib/types/branding.ts` | Campi minimi required per complete |

## Step di implementazione

1. Definire campi minimi per `onboardingCompleted = true` (name, slug, primary color, phone o address, tagline).
2. Scrivere RPC `create_company_with_admin` + test SQL slug collision.
3. UI wizard step 1–6 con persistenza progressiva (salvataggi parziali su `settings.branding` dopo step 2).
4. Validazione slug live (`select` existence o RPC `check_slug_available`).
5. Guard navigazione: admin incompleto non entra in kitchen/dashboard finché non completa.
6. Post go-live: `refreshBranding()` + navigate a landing preview.
7. Aggiornare docs `DEPLOYMENT-STRATEGY.md` § onboarding: self-service è il path primario; SQL resta fallback ops.

## Acceptance criteria

- [ ] Un utente nuovo può creare company + diventare admin senza SQL manuale
- [ ] Slug duplicato → errore chiaro, nessun insert parziale
- [ ] Dopo go-live, subdomain/slug resolve mostra branding inserito
- [ ] Admin con onboarding incompleto è gated sul wizard
- [ ] RLS: un admin non può aggiornare `companies` di un altro tenant
- [ ] Ops settings esistenti del seed Ambrosia non regressano

## Rischi / note

- **Privilege escalation**: RPC deve verificare che l’utente non sia già admin di un’altra company (v1: 1 company per admin).
- Signup attuale crea sempre `customer`: non cambiare il trigger; usare solo RPC per promozione.
- Subdomain DNS wildcard deve già esistere in prod; in locale testare con fallback `EXPO_PUBLIC_COMPANY_ID` dopo create.
- Upload logo può essere skippabile: non bloccare go-live.
- Non implementare billing qui: `companies.plan` default `starter` / `free`.
