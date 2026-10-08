import { expect, test } from '@playwright/test';
const orderId = '00000000-0000-0000-0000-000000000021';
const pending = { id: orderId, display_code: 'Diavola #1', status: 'pending', order_type: 'take_away', created_at: new Date().toISOString(), total_amount: 6.5, order_items: [] };
test.describe('customer order confirmation', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    // Every backend request is intercepted: never sends restaurant orders.
    await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
    await page.route('**/functions/v1/**', route => route.fulfill({ status: 503, json: { error: 'test only' } }));
  });
  test('pending becomes accepted and ready via guest polling without Realtime', async ({ page }) => {
    let status = 'pending';
    await page.route('**/rest/v1/rpc/get_order_tracking', route => route.fulfill({ json: { ...pending, status } }));
    await page.goto(`/order-tracking?orderId=${orderId}&orderType=take_away`);
    await expect(page.getByText('Ordine inviato. La cucina deve ancora accettarlo.')).toBeVisible();
    await expect(page.getByText('Da confermare', { exact: true })).toBeVisible();
    status = 'preparing';
    await expect(page.getByText('La cucina ha accettato il tuo ordine e ha iniziato la preparazione.')).toBeVisible({ timeout: 12000 });
    await expect(page.getByText('Ordine inviato. La cucina deve ancora accettarlo.')).toBeHidden();
    status = 'ready';
    await expect(page.getByText('Ordine pronto!', { exact: true })).toBeVisible({ timeout: 12000 });
    await page.screenshot({ path: 'test-results/customer-order-ready.png', fullPage: true });
  });
  test('a server failure never masquerades as a pending or accepted order', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_order_tracking', route => route.fulfill({ status: 503, json: { message: 'server unavailable' } }));
    await page.goto(`/order-tracking?orderId=${orderId}`);
    await expect(page.getByText('Stato dell’ordine non verificabile')).toBeVisible({ timeout: 12000 });
    await expect(page.getByText('Ordine inviato. La cucina deve ancora accettarlo.')).toBeHidden();
    await page.screenshot({ path: 'test-results/customer-order-unavailable.png', fullPage: true });
  });
  test('the success route does not falsely confirm a pending order', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_order_tracking', route => route.fulfill({ json: pending }));
    await page.goto(`/order-success?orderId=${orderId}`);
    await expect(page.getByText('Ordine inviato', { exact: true })).toBeVisible();
    await expect(page.getByText(/Order Confirmed|is now in preparation/)).toBeHidden();
  });
});
