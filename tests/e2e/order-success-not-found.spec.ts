import { expect, test } from '@playwright/test';

// /order-success with an order id that does not exist must say so, never
// "Ordine #N". Every backend request is mocked: no real orders, never prod.
const unknownId = '00000000-0000-0000-0000-0000000000ff';
const realId = '00000000-0000-0000-0000-000000000021';
const pending = { id: realId, display_code: 'Ordine #12', status: 'pending', order_type: 'take_away', created_at: new Date().toISOString(), total_amount: 6.5, order_items: [] };

test.describe('order success: unknown order id', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  let trackingCalls: string[];
  test.beforeEach(async ({ page }) => {
    trackingCalls = [];
    await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
    await page.route('**/functions/v1/**', route => route.fulfill({ status: 503, json: { error: 'test only' } }));
    await page.route('**/rest/v1/rpc/get_order_tracking', async route => {
      const body = route.request().postDataJSON() as { p_order_id?: string };
      trackingCalls.push(body?.p_order_id ?? '');
      // PostgREST: a scalar jsonb function returning NULL answers `null`.
      if (body?.p_order_id === realId) return route.fulfill({ json: pending });
      return route.fulfill({ contentType: 'application/json', body: 'null' });
    });
  });

  for (const [label, query] of [
    ['made-up text id', 'orderId=123'],
    ['made-up text id with a fake display code', 'orderId=fake&displayCode=Ordine%20%2399'],
    ['well-formed uuid the server does not know', `orderId=${unknownId}`],
    ['no order id', ''],
  ] as const) {
    test(`${label}: shows "Ordine non trovato", no order code`, async ({ page }) => {
      await page.goto(`/order-success${query ? `?${query}` : ''}`);
      await expect(page.getByText('Ordine non trovato', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Ordine #\d+/)).toHaveCount(0);
      await expect(page.getByText('Segui l’ordine')).toHaveCount(0);
      await expect(page.getByText('Riepilogo ordine')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Torna al menu', exact: true })).toBeVisible();
    });
  }

  test('unknown uuid is looked up once (no polling, no retry)', async ({ page }) => {
    await page.goto(`/order-success?orderId=${unknownId}`);
    await expect(page.getByText('Ordine non trovato', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(6500);
    expect(trackingCalls.filter(id => id === unknownId)).toHaveLength(1);
  });

  test('a made-up text id never reaches the server', async ({ page }) => {
    await page.goto('/order-success?orderId=not-an-order');
    await expect(page.getByText('Ordine non trovato', { exact: true })).toBeVisible({ timeout: 15000 });
    expect(trackingCalls).toHaveLength(0);
  });

  test('a real order still shows its code', async ({ page }) => {
    await page.goto(`/order-success?orderId=${realId}`);
    await expect(page.getByText('Ordine inviato', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Ordine #12/)).toBeVisible();
    await expect(page.getByText('Ordine non trovato', { exact: true })).toHaveCount(0);
  });

  test('server unavailable is not "not found"', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_order_tracking', route => route.fulfill({ status: 503, json: { message: 'server unavailable' } }));
    await page.goto(`/order-success?orderId=${realId}`);
    await expect(page.getByText('Verifica ordine', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Ordine non trovato', { exact: true })).toHaveCount(0);
  });
});
