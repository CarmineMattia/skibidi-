import { expect, test, type Page } from '@playwright/test';
import { mockLoggedInCustomer } from './fixtures/mockSession';

/**
 * Turnstile nel checkout, tutto con mock (nessuna chiamata a Cloudflare o a Supabase, nessun ordine vero).
 * Il comportamento dipende dalla build:
 * - senza EXPO_PUBLIC_TURNSTILE_SITE_KEY (prod oggi) gira solo il primo test;
 * - con la site key (es. la chiave di test Cloudflare 1x00000000000000000000AA) girano gli altri.
 * Build con la chiave di test: la variabile viene inserita da Metro al momento della build, e una cache
 * Metro già piena la ignora (widget mai mostrato, chiave assente dal bundle). Usare SEMPRE `--clear`:
 *   EXPO_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npx expo export --platform web --clear && node scripts/copy-404.mjs
 *   (stesso discorso tornando alla build senza chiave: di nuovo `--clear`)
 * Percorsi coperti: `/modal` (il checkout che apre il carrello, a passi) e `/one-screen-checkout`.
 */

const FAKE_TURNSTILE = `
  window.__ts = { issued: 0, delivered: 0, opts: null };
  window.turnstile = {
    render(el, opts) {
      window.__ts.opts = { sitekey: opts.sitekey, action: opts.action };
      window.__ts.issue = () => { window.__ts.issued++; const n = window.__ts.issued; setTimeout(() => { opts.callback('fake-token-' + n); window.__ts.delivered = n; }, 50); };
      window.__ts.issue();
      return 'w1';
    },
    reset() { window.__ts.issue && window.__ts.issue(); },
    remove() {},
  };`;

type Calls = { verify: string[]; rpc: number; order: string[] };

async function fillCustomer(page: Page) {
  const name = page.getByPlaceholder('Nome', { exact: true });
  const phone = page.getByPlaceholder('Telefono', { exact: true });
  await expect(async () => {
    await name.fill('Cliente di prova');
    await phone.fill('3331234567');
    await page.waitForTimeout(500);
    await expect(name).toHaveValue('Cliente di prova', { timeout: 100 });
    await expect(phone).toHaveValue('3331234567', { timeout: 100 });
  }).toPass({ timeout: 30000 });
}

/** Risposta della funzione: stato + codice come handler.ts; 'hang' = non risponde mai. */
type VerifyReply = number | [number, string] | 'hang';
const VERIFY_CODES: Record<number, string> = {
  400: 'missing_token', 401: 'login_required', 403: 'turnstile_failed', 404: 'not_found', 409: 'turnstile_expired',
  500: 'pass_not_saved', 502: 'turnstile_unavailable', 503: 'turnstile_not_configured',
};

/** /modal: il checkout a passi aperto dal carrello (tipo → orario → dati → riepilogo). */
async function toModalSummary(page: Page) {
  await page.goto('/modal');
  await expect(page.getByText('Da asporto').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.getByText('Da asporto').first().click();
  await page.getByText('Continua', { exact: true }).last().click();
  await expect(page.getByText('Indietro', { exact: true }).last()).toBeVisible();
  await page.getByText('Continua', { exact: true }).last().click();
  const name = page.getByPlaceholder('Il tuo nome');
  await expect(name).toBeVisible({ timeout: 10000 });
  await name.fill('Cliente di prova');
  await page.getByPlaceholder('Es: 3331234567').fill('3331234567');
  await page.getByText('Continua', { exact: true }).last().click();
  await expect(page.getByText('Conferma ordine', { exact: true }).last()).toBeVisible({ timeout: 10000 });
}

type Route = '/modal' | '/one-screen-checkout';

async function setup(
  page: Page,
  verifyReplies: VerifyReply[],
  rpc: (n: number) => { status: number; json: unknown } | 'ok' = () => 'ok',
  route: Route = '/one-screen-checkout'
): Promise<Calls> {
  const calls: Calls = { verify: [], rpc: 0, order: [] };
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE })
  );
  await page.route('**/functions/v1/verify-turnstile', async (route) => {
    calls.verify.push(route.request().postDataJSON()?.token);
    calls.order.push('verify');
    const reply = verifyReplies[Math.min(calls.verify.length - 1, verifyReplies.length - 1)] ?? 200;
    if (reply === 'hang') {
      await new Promise((r) => setTimeout(r, 25000));
      return route.fulfill({ status: 200, json: { ok: true } }).catch(() => {});
    }
    const [status, error] = Array.isArray(reply) ? reply : [reply, VERIFY_CODES[reply] ?? `status ${reply}`];
    await route.fulfill({ status, json: status === 200 ? { ok: true } : { error } });
  });
  await page.route('**/rest/v1/rpc/create_order_with_items', async (route) => {
    calls.rpc++;
    calls.order.push('rpc');
    const body = route.request().postDataJSON();
    const res = rpc(calls.rpc);
    if (res !== 'ok') return route.fulfill(res);
    await page.route('**/rest/v1/rpc/get_order_tracking', (t) => t.fulfill({ json: {
      id: body.p_order.id, display_code: 'Diavola #1', total_amount: 6.5,
      status: 'pending', order_type: 'take_away', created_at: new Date().toISOString(), order_items: [],
    } }));
    await route.fulfill({ json: { id: body.p_order.id, total_amount: 6.5 } });
  });
  await mockLoggedInCustomer(page);
  await page.addInitScript(() => {
    localStorage.setItem('ambrosia.cart.v1', JSON.stringify([
      { product: { id: 'pizza-test', company_id: '00000000-0000-0000-0000-000000000001', name: 'Diavola', price: 6.5, active: true }, quantity: 1 },
    ]));
  });
  if (route === '/modal') {
    await toModalSummary(page);
  } else {
    await page.goto('/one-screen-checkout');
    await fillCustomer(page);
  }
  return calls;
}

const hasWidget = async (page: Page) => (await page.getByTestId('turnstile-widget').count()) > 0;
const submit = async (page: Page) => {
  const button = page.getByRole('button', { name: /Conferma ordine/ });
  if (await button.count()) return button.last().click();
  return page.getByText('Conferma ordine', { exact: true }).last().click();
};
/** Attende che il widget finto abbia CONSEGNATO l'n-esimo token al checkout (non solo emesso). */
const tokenIssued = async (page: Page, n: number) => {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ts?: { delivered: number } }).__ts?.delivered ?? 0)).toBeGreaterThanOrEqual(n);
  await page.waitForTimeout(300); // stato React aggiornato
};

test('senza site key: nessun widget, nessuna chiamata a verify-turnstile, ordine inviato', async ({ page }) => {
  const calls = await setup(page, [500]);
  test.skip(await hasWidget(page), 'build con site key');
  await submit(page);
  await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
  expect(calls).toEqual({ verify: [], rpc: 1, order: ['rpc'] });
});

test.describe('con site key', () => {
  test('token verificato prima di create_order_with_items, azione checkout', async ({ page }) => {
    const calls = await setup(page, [200]);
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    expect(await page.evaluate(() => (window as unknown as { __ts: { opts: unknown } }).__ts.opts)).toMatchObject({ action: 'checkout' });
    await submit(page);
    await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
    expect(calls).toEqual({ verify: ['fake-token-1'], rpc: 1, order: ['verify', 'rpc'] });
  });

  test('token rifiutato: niente ordine, messaggio, nuovo token; al secondo tentativo passa', async ({ page }) => {
    const calls = await setup(page, [403, 200]);
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    await submit(page);
    await expect(page.getByRole('alert')).toContainText('Conferma di non essere un robot', { timeout: 10000 });
    expect(calls.rpc).toBe(0);
    await tokenIssued(page, 2);
    await submit(page);
    await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
    expect(calls.verify).toEqual(['fake-token-1', 'fake-token-2']);
    expect(calls.rpc).toBe(1);
  });

  test('funzione non deployata (404): l\'ordine parte lo stesso e decide il server', async ({ page }) => {
    const calls = await setup(page, [404]);
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    await submit(page);
    await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
    expect(calls.order).toEqual(['verify', 'rpc']);
  });

  test('il server chiede il captcha (require_turnstile): messaggio e nuovo token', async ({ page }) => {
    const calls = await setup(page, [503], (n) =>
      n === 1 ? { status: 400, json: { code: 'P0001', message: 'ANTIABUSE_CAPTCHA_REQUIRED' } } : 'ok'
    );
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    await submit(page);
    await expect(page.getByRole('alert')).toContainText('Conferma di non essere un robot', { timeout: 10000 });
    await tokenIssued(page, 2);
    expect(calls.rpc).toBe(1);
  });
});

test.describe('/modal (checkout del carrello)', () => {
  test('senza site key: nessun widget, nessuna chiamata a verify-turnstile, ordine inviato', async ({ page }) => {
    const calls = await setup(page, [500], undefined, '/modal');
    test.skip(await hasWidget(page), 'build con site key');
    await submit(page);
    await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
    expect(calls).toEqual({ verify: [], rpc: 1, order: ['rpc'] });
  });

  test('con site key: verify poi create_order_with_items', async ({ page }) => {
    const calls = await setup(page, [200], undefined, '/modal');
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    await submit(page);
    await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
    expect(calls).toEqual({ verify: ['fake-token-1'], rpc: 1, order: ['verify', 'rpc'] });
  });

  test('con site key: token rifiutato (403 turnstile_failed): niente ordine, messaggio, nuovo token', async ({ page }) => {
    const calls = await setup(page, [403, 200], undefined, '/modal');
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    await submit(page);
    await expect(page.getByText(/non essere un robot/).first()).toBeVisible({ timeout: 10000 });
    expect(calls.rpc).toBe(0);
    await tokenIssued(page, 2);
  });

  for (const reply of [[403, 'turnstile_wrong_action'], [503, 'turnstile_wrong_site'], 502, 503, 409] as VerifyReply[]) {
    test(`con site key: verify ${JSON.stringify(reply)} non blocca, decide il server`, async ({ page }) => {
      const calls = await setup(page, [reply], undefined, '/modal');
      test.skip(!(await hasWidget(page)), 'build senza site key');
      await tokenIssued(page, 1);
      await submit(page);
      await expect(page).toHaveURL(/order-tracking\?/, { timeout: 20000 });
      expect(calls.order).toEqual(['verify', 'rpc']);
    });
  }

  test('con site key: verify-turnstile appesa, dopo 5 s l\'ordine parte (niente "Invio in corso…" infinito)', async ({ page }) => {
    test.setTimeout(60000);
    const calls = await setup(page, ['hang'], undefined, '/modal');
    test.skip(!(await hasWidget(page)), 'build senza site key');
    await tokenIssued(page, 1);
    const t0 = Date.now();
    await submit(page);
    await expect(page).toHaveURL(/order-tracking\?/, { timeout: 15000 });
    expect(Date.now() - t0).toBeLessThan(12000);
    expect(calls.order).toEqual(['verify', 'rpc']);
  });
});
