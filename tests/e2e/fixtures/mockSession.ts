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

export const MOCK_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
export const MOCK_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export type MockRole = 'customer' | 'admin';

export async function mockLoggedInCustomer(page: Page) {
  return mockLoggedInUser(page, 'customer');
}

/** Admin (anche cucina: la cucina è riservata al ruolo admin). */
export async function mockLoggedInAdmin(page: Page) {
  return mockLoggedInUser(page, 'admin');
}

export async function mockLoggedInUser(page: Page, role: MockRole) {
  const userId = role === 'admin' ? MOCK_ADMIN_ID : MOCK_USER_ID;
  const email = role === 'admin' ? 'admin.e2e@example.com' : 'cliente.e2e@example.com';
  const fullName = role === 'admin' ? 'Admin di prova' : 'Cliente di prova';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: fullName },
    created_at: '2026-01-01T00:00:00Z',
  };
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, role: 'authenticated', aud: 'authenticated', exp })}.e2e`;
  const session = { access_token: accessToken, refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
  const profile = { id: userId, role, email: user.email, full_name: fullName, company_id: role === 'admin' ? MOCK_COMPANY_ID : null, created_at: user.created_at, updated_at: user.created_at };

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
