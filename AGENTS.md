# AGENTS.md

## Cursor Cloud specific instructions

### Overview
**Skibidi Orders** is a React Native / Expo restaurant POS system (Italian market). It runs on web, Android, and iOS via Expo SDK 54. The backend is a hosted Supabase instance (PostgreSQL + Auth + Realtime).

### Package manager
Use **npm** exclusively (`package-lock.json` present). Yarn and pnpm are not supported.

### Environment variables
Copy `.env.example` to `.env` and fill in Supabase credentials. The app requires:
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for database/auth.
- Fiscal API settings default to mock mode (`EXPO_PUBLIC_FISCAL_MOCK_MODE=true`), so no real fiscal provider is needed.

### Running the app (web)
```
npm run web          # or: npx expo start --web --port 8081
```
The Expo dev server serves on port 8081 by default. The app starts in **kiosk mode** (anonymous guest access) and loads the dashboard at `/`. The menu page is at `/menu`.

### Type checking
```
npx tsc --noEmit
```
This is the primary code quality check. There is one pre-existing warning (`components/ExternalLink.tsx` has an unused `@ts-expect-error` directive) that is safe to ignore.

### Lint / Test
- No ESLint config or lint script is defined in `package.json` yet.
- No Jest config or test script is defined yet. A single snapshot test exists at `components/__tests__/StyledText-test.js` but requires manual setup to run.

### Gotchas
- The Metro bundler logs `FORCE_COLOR` / `NO_COLOR` env conflict warnings at startup — these are harmless.
- `expo start` automatically loads `.env` via the `dotenv` integration; no manual sourcing is needed.
- Without valid Supabase credentials, the app UI loads fine but data-dependent pages (menu, kitchen, orders) show empty states. This is expected.
