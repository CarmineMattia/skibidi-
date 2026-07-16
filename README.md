# Skibidi Orders

POS / ordering system for restaurants: customer web & mobile ordering, kitchen display, admin dashboard, and Italian fiscal integration (Epson RT).

Built with **Expo (React Native)**, **TypeScript**, **Supabase**, and **NativeWind**.

## Quick start

```bash
# 1. Clone
git clone https://github.com/CarmineMattia/skibidi-.git
cd skibidi-

# 2. Install
npm install

# 3. Environment
cp .env.example .env
# Edit .env — at minimum set:
#   EXPO_PUBLIC_SUPABASE_URL
#   EXPO_PUBLIC_SUPABASE_ANON_KEY
#   EXPO_PUBLIC_COMPANY_ID

# 4. Run (web is the fastest way to verify)
npm run web
```

For a full local Supabase + Auth setup (migrations, OTP login, admin user), see **[SETUP-GUIDE.md](./SETUP-GUIDE.md)**.

To contribute via pull request, see **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 20+ (LTS recommended) |
| npm | 10+ |
| Git | any recent |
| Expo Go / emulator | optional (native) |

## Scripts

| Command | What it does |
|---------|----------------|
| `npm start` | Expo dev server (press `w` / `a` / `i`) |
| `npm run web` | Start web target |
| `npm run android` / `npm run ios` | Native targets |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npx playwright test` | E2E tests (app must be running, or set `PLAYWRIGHT_BASE_URL`) |
| `npx vitest run` | Unit tests under `tests/unit` |

## Project layout

```
app/                 # Expo Router screens
components/
  ui/                # Shared UI primitives
  features/          # Feature-specific UI
lib/
  api/               # Supabase client
  hooks/             # Data & domain hooks
  stores/            # React contexts
  fiscal/            # RT / fiscal providers
  utils/             # Helpers
supabase/
  migrations/        # SQL migrations (apply in order)
types/               # Shared TypeScript types
tests/               # Playwright + Vitest
```

## Environment

Never commit `.env`. Copy from `.env.example`.

**Minimum to run the app against an existing Supabase project:**

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_COMPANY_ID=00000000-0000-0000-0000-000000000001
```

Fiscal keys and service-role keys are optional for UI development (`EXPO_PUBLIC_FISCAL_MOCK_MODE=true` by default).

## Database migrations

Migrations live in `supabase/migrations/`. Apply them in filename order on your Supabase project (SQL Editor or Supabase CLI).

If you only need the latest order-related features on an already-provisioned DB, see `supabase/apply-order-features-manual.sql` as a convenience script (prefer migrations for new environments).

## Contributing

1. Fork or create a feature branch from `main`
2. Make focused changes
3. Run `npm run type-check` (and tests relevant to your change)
4. Open a PR — details in [CONTRIBUTING.md](./CONTRIBUTING.md)

Commit messages must match the repo hook format:

```text
{message} ({taskId}) tests: {what you tested}
```

Example:

```text
add: landing page and offers carousel (TASK147) tests: npm run type-check, landing playwright smoke
```

## License

Proprietary — all rights reserved.
