import type { Page } from '@playwright/test';

/**
 * Sessione Supabase finta per gli e2e: il login è solo Google, quindi il
 * checkout richiede un utente autenticato. Nessuna chiamata reale ad auth:
 * la sessione viene scritta in localStorage e le rotte /auth/v1 e /profiles
 * vengono intercettate. Chiamare DOPO le altre page.route (vince l'ultima).
 */
export const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://e2e-placeholder.supabase.co';
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

export async function mockLoggedInCustomer(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'cliente.e2e@example.com',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: 'Cliente di prova' },
    created_at: '2026-01-01T00:00:00Z',
  };
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: MOCK_USER_ID, role: 'authenticated', aud: 'authenticated', exp })}.e2e`;
  const session = { access_token: accessToken, refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
  const profile = { id: MOCK_USER_ID, role: 'customer', email: user.email, full_name: 'Cliente di prova', company_id: null, created_at: user.created_at, updated_at: user.created_at };

  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: user });
    if (url.includes('/auth/v1/token')) return route.fulfill({ json: session });
    return route.fulfill({ json: {} });
  });
  await page.route('**/rest/v1/profiles?**', (route) => {
    const single = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    return route.fulfill({ json: single ? profile : [profile] });
  });
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)] as const,
  );
}
