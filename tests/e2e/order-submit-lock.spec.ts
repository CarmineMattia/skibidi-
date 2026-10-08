import { expect, test } from '@playwright/test';

test('a rejected submission shows a visible error, preserves the cart and allows retry', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/auth/v1/**', route => route.fulfill({ status: 401, json: { message: 'test guest' } }));
  await page.route('**/functions/v1/**', route => route.fulfill({ status: 503, json: { error: 'test only' } }));
  await page.route('**/rest/v1/rpc/create_order_with_items', route => route.fulfill({
    status: 404, json: { code: 'PGRST202', message: 'Function unavailable' },
  }));
  await page.addInitScript(() => {
    localStorage.setItem('ambrosia.cart.v1', JSON.stringify([
      { product: { id: 'pizza-test', company_id: '00000000-0000-0000-0000-000000000001', name: 'Diavola', price: 6.5, active: true }, quantity: 1 },
    ]));
  });
  await page.goto('/one-screen-checkout');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Cliente di prova');
  await page.getByPlaceholder('Telefono', { exact: true }).fill('3331234567');
  await page.getByRole('button', { name: /Conferma ordine/ }).click();
  await expect(page.getByRole('alert')).toContainText('Invio non confermato', { timeout: 10000 });
  await expect(page.getByRole('button', { name: /Conferma ordine/ })).toBeEnabled();
  await expect(page).toHaveURL(/one-screen-checkout/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ambrosia.cart.v1') || '[]').length)).toBe(1);
  await page.screenshot({ path: 'test-results/order-submission-error-visible.png', fullPage: true });
});

test('confirmation stays disabled through a slow submission and sends one order', async ({ page }) => {
  let submissions = 0;
  let release: () => void = () => {};
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  // All backend traffic is intercepted; this never places a restaurant order.
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/auth/v1/**', route => route.fulfill({ status: 401, json: { message: 'test guest' } }));
  await page.route('**/functions/v1/**', route => route.fulfill({ status: 503, json: { error: 'test only' } }));
  await page.route('**/rest/v1/rpc/create_order_with_items', async route => {
    submissions++;
    const body = route.request().postDataJSON();
    await responseGate;
    await page.route('**/rest/v1/rpc/get_order_tracking', tracking => tracking.fulfill({ json: {
      id: body.p_order.id, display_code: 'Diavola #1', total_amount: 6.5,
      status: 'pending', order_type: 'take_away', created_at: new Date().toISOString(), order_items: [],
    } }));
    await route.fulfill({ json: { id: body.p_order.id, total_amount: 6.5 } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('ambrosia.cart.v1', JSON.stringify([
      { product: { id: 'pizza-test', company_id: '00000000-0000-0000-0000-000000000001', name: 'Diavola', price: 6.5, active: true }, quantity: 1 },
    ]));
  });
  await page.goto('/one-screen-checkout');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Cliente di prova');
  await page.getByPlaceholder('Telefono', { exact: true }).fill('3331234567');
  await page.getByRole('button', { name: /Conferma ordine/ }).click();
  const sending = page.getByRole('button', { name: 'Invio in corso…' });
  await expect(sending).toBeDisabled();
  await expect(page.getByText('Invio dell’ordine in corso…')).toBeVisible();
  // Exercise repeated input against the disabled element without waiting for it to enable.
  await sending.dispatchEvent('click');
  await sending.dispatchEvent('click');
  await expect.poll(() => submissions).toBe(1);
  await page.waitForTimeout(5500);
  await expect(sending).toBeDisabled();
  expect(submissions).toBe(1);
  release();
  await expect(page).toHaveURL(/order-tracking\?/);
  expect(submissions).toBe(1);
});
