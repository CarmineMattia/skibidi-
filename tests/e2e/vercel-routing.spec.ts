import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockEmptyBackend } from './fixtures/mockBackend';
import { mockLoggedInAdmin, mockLoggedInCustomer } from './fixtures/mockSession';

/**
 * Static export served like Vercel (cleanUrls, no catch-all rewrite): every
 * route must get its own pre-rendered HTML, otherwise React hydrates the home
 * markup on another route and throws minified error #418.
 *
 * Runs only against the local static server (never prod):
 *   npm run build:web && npm run serve:web -- 4173 &
 *   VERCEL_STATIC_E2E=1 PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test tests/e2e/vercel-routing.spec.ts --project=chromium
 */
test.skip(!process.env.VERCEL_STATIC_E2E, 'needs the static export served by scripts/serve-vercel-static.mjs');

const dist = path.resolve(process.env.DIST_DIR || 'dist');
const html = (file: string) => fs.readFileSync(path.join(dist, file), 'utf8');
const hydrationError = /#418|#423|#425|Minified React error|hydrat/i;

const routes: { url: string; file: string; as?: 'customer' | 'admin' }[] = [
  { url: '/', file: 'index.html' },
  { url: '/menu', file: 'menu.html' },
  { url: '/offers', file: 'offers.html' },
  { url: '/login', file: 'login.html' },
  { url: '/login?admin=1', file: 'login.html' },
  { url: '/one-screen-checkout', file: 'one-screen-checkout.html', as: 'customer' },
  { url: '/account', file: 'account.html', as: 'customer' },
  { url: '/order-tracking?orderId=00000000-0000-4000-8000-000000000001&orderType=delivery', file: 'order-tracking.html', as: 'customer' },
  { url: '/order-success?orderId=00000000-0000-4000-8000-000000000001&displayCode=A%20%231', file: 'order-success.html', as: 'customer' },
  { url: '/admin-dashboard', file: 'admin-dashboard.html', as: 'admin' },
  { url: '/admin-options', file: 'admin-options.html', as: 'admin' },
  { url: '/kitchen', file: 'kitchen.html', as: 'admin' },
];

for (const r of routes) {
  test(`${r.url} serves ${r.file} and hydrates without #418`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && hydrationError.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => { if (hydrationError.test(e.message)) errors.push(e.message); });
    await mockEmptyBackend(page);
    if (r.as === 'admin') await mockLoggedInAdmin(page);
    if (r.as === 'customer') await mockLoggedInCustomer(page);

    const res = await page.goto(r.url, { waitUntil: 'load' });
    expect(res?.status()).toBe(200);
    expect(await res?.text()).toBe(html(r.file));
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}

test('unknown path gets the app 404 page with status 404', async ({ page }) => {
  await mockEmptyBackend(page);
  const res = await page.goto('/questa-pagina-non-esiste');
  expect(res?.status()).toBe(404);
  expect(await res?.text()).toBe(html('+not-found.html'));
});

test('/menu.html redirects to the clean URL', async ({ request }) => {
  const res = await request.get('/menu.html', { maxRedirects: 0 });
  expect([301, 308]).toContain(res.status());
  expect(res.headers()['location']).toBe('/menu');
});
