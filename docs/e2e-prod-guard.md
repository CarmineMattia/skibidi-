# Guardia prod per gli e2e Playwright

**Regola:** gli e2e non girano mai contro la produzione con login reali o scritture.

Il 2026-10-14 un run degli e2e di `main` con la chiave di prod ha fatto login reali come
`admin@skibidi.com` e `customer@skibidi.com` e ha tentato delle scritture (nessun dato modificato,
solo `last_sign_in_at`). Da qui la guardia.

## Come funziona
- `tests/fixtures/prodGuard.ts` decide se il target è prod. Basta uno di questi segnali:
  - un Supabase URL (`EXPO_PUBLIC_SUPABASE_URL` o `SUPABASE_URL`, da env, `.env`, `.env.local`, `.env.production[.local]` o `.env.development[.local]`)
    contiene `zqubwvhstobaugifzoyb`, senza distinzione maiuscole/minuscole;
  - il Supabase URL è un custom domain di prod (`PROD_SUPABASE_HOSTS` nel file, oppure
    `E2E_PROD_SUPABASE_HOSTS=host1,host2`);
  - la anon key (`EXPO_PUBLIC_SUPABASE_ANON_KEY` o `SUPABASE_ANON_KEY`) è un JWT con `ref` di prod;
  - `PLAYWRIGHT_BASE_URL` punta a `skibidi-eight-virid.vercel.app` o a una preview Vercel
    dell'account (`*-carminemattias-projects.vercel.app`).
  - Gli host sono normalizzati: percent-decoding, minuscolo, senza punto finale.
- Test unitari: `tests/unit/prodGuard.spec.ts`.
- Se il target è prod, `loginAsAdmin`, `loginAsCustomer` e `hasAdminAccount` restituiscono `false`
  senza toccare il login, quindi i test admin, cucina e accessi si saltano. I test 4 e 5 di
  `security-access-control.spec.ts` (login + scritture via API) e il test "unknown credentials" di `auth.spec.ts` (tentativo di login reale) vengono saltati con `test.skip`.
- `tests/global-setup.ts` stampa un avviso all'avvio quando il target è prod.
- Il fallback del Supabase URL in `security-access-control.spec.ts` non punta più a prod.

## Opt-in
`E2E_ALLOW_PROD=1` riabilita login reali e scritture contro prod. Solo con OK esplicito di Carmine,
mai in CI (con `CI` impostato il global setup fallisce).

## Default consigliato
Gli e2e girano con il placeholder (`https://e2e-placeholder.supabase.co`, impostato da
`playwright.config.ts`) e con le risposte di Supabase mockate (`page.route`).

## Test nuovi
Un test che fa login reali o scritture deve usare gli helper di `page-objects.ts` oppure chiamare
`test.skip(mustSkipRealAuth(), PROD_SKIP_REASON)`.
