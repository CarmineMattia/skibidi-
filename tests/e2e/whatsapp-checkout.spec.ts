import { expect, test } from '@playwright/test';
import { mockLoggedInCustomer, MOCK_COMPANY_ID } from './fixtures/mockSession';

const productId = 'c3a38515-a76b-468a-9d12-9c6c4cbac0c1';
const categoryId = '894ddc6e-6dd8-4922-826a-c02274741713';
const product = {
  id: productId, category_id: categoryId, company_id: MOCK_COMPANY_ID,
  name: 'Capricciosa', price: 7.5, active: true,
};
const preview = `/ordine-whatsapp?righe=${productId}.2`;

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/products?**', route => route.fulfill({ json: [product] }));
  await page.route('**/rest/v1/categories?**', route => route.fulfill({
    json: [{ id: categoryId, name: 'Classiche', active: true }],
  }));
  await page.route('**/functions/v1/**', route => route.fulfill({ status: 503, json: {} }));
});

test('an imported cart reaches tracking only after explicit checkout confirmation', async ({ page }) => {
  let submissions = 0;
  await mockLoggedInCustomer(page);
  await page.route('**/rest/v1/rpc/create_order_with_items', async route => {
    submissions++;
    const { p_order, p_items } = route.request().postDataJSON();
    expect(p_items).toEqual([expect.objectContaining({ product_id: productId, quantity: 2 })]);
    expect(p_order).toMatchObject({ status: 'pending', fiscal_status: 'pending', order_type: 'take_away' });
    await page.route('**/rest/v1/rpc/get_order_tracking', tracking => tracking.fulfill({
      json: { id: p_order.id, display_code: 'Ordine #1', status: 'pending', order_items: p_items },
    }));
    await route.fulfill({ json: { id: p_order.id, display_code: 'Ordine #1', total_amount: 15 } });
  });

  await page.goto(preview);
  await expect(page.getByText('2× Capricciosa')).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByRole('button', { name: 'Continua al checkout' }).click();
  await expect(page).toHaveURL(/one-screen-checkout/);
  await expect(page.getByText('2× Capricciosa')).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByPlaceholder('Nome', { exact: true }).fill('Cliente di prova');
  await page.getByPlaceholder('Telefono', { exact: true }).fill('3331234567');
  await page.getByRole('button', { name: /Conferma ordine/ }).click();
  await expect.poll(() => submissions).toBe(1);
  await expect(page).toHaveURL(/order-tracking\?/, { timeout: 15000 });
  expect(submissions).toBe(1);
});

test('a Google sign-in return restores the same draft before checkout', async ({ page }) => {
  await page.goto(preview);
  const signIn = page.getByRole('button', { name: 'Accedi con Google per continuare' });
  await expect(signIn).toBeEnabled();
  await mockLoggedInCustomer(page);
  await page.route('**/auth/v1/authorize?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const destination = params.get('redirect_to');
    expect(params.get('provider')).toBe('google');
    expect(new URL(destination!).pathname).toBe('/login');
    await route.fulfill({ status: 302, headers: { location: destination! } });
  });
  await signIn.click();
  await expect(page.getByRole('button', { name: 'Continua al checkout' })).toBeEnabled();
  await expect(page.getByText('2× Capricciosa')).toBeVisible();
  await expect(page).toHaveURL(/ordine-whatsapp\?righe=/);
});

test('the draft requires sign-in and rejects a product missing from the active catalog', async ({ page }) => {
  await page.goto(preview);
  await expect(page.getByRole('button', { name: 'Accedi con Google per continuare' })).toBeEnabled();
  await page.goto('/ordine-whatsapp?righe=00000000-1111-4222-8333-444444444444.2');
  await expect(page.getByText('Uno o più prodotti richiedono una nuova scelta dal menu.')).toBeVisible();
  await expect(page.getByRole('button', { name: /per continuare|Continua al checkout/ })).toHaveCount(0);
});
