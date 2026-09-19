import { expect, test } from '@playwright/test';

const categories = [
  { id: 'pizza-category', name: 'Classiche', active: true, display_order: 1 },
  { id: 'drinks-category', name: 'Bevande', active: true, display_order: 2 },
];
const products = [
  { id: 'pizza-product', category_id: 'pizza-category', name: 'Margherita', description: 'Pomodoro e mozzarella', price: 5, ingredients: ['pomodoro', 'mozzarella'], active: true, display_order: 1 },
  { id: 'drink-product', category_id: 'drinks-category', name: 'Acqua', description: null, price: 1, ingredients: [], active: true, display_order: 2 },
];

test.describe('menu and cart persistence', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/products?**', route => route.fulfill({ json: products }));
    await page.route('**/rest/v1/categories?**', route => route.fulfill({ json: categories }));
    // These tests never create real orders or payments.
    await page.route('**/functions/v1/**', route => route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }));
    await page.goto('/menu');
    await expect(page.getByPlaceholder('Cerca pizza, bevanda...')).toBeVisible();
  });

  test('search survives reload, category clears search, cart survives reload and clears explicitly', async ({ page }) => {
    const search = page.getByPlaceholder('Cerca pizza, bevanda...');
    await search.fill('Margherita');
    await page.getByRole('button', { name: 'Aggiungi Margherita al carrello' }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ambrosia.cart.v1') || '[]').length)).toBe(1);
    await page.reload();
    await expect(search).toHaveValue('Margherita');
    await page.getByRole('button', { name: 'Bevande', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Aggiungi Acqua al carrello' })).toBeVisible();
    await page.getByRole('button', { name: /Carrello: 1/ }).click();
    await expect(page.getByText('€5.00').first()).toBeVisible();
    await page.getByRole('button', { name: 'Prepara svuota tutto' }).click();
    await expect(page.getByRole('button', { name: 'Conferma elimina Margherita' })).toBeVisible();
    await page.getByRole('button', { name: 'Conferma svuota tutto il carrello' }).click();
    await expect(page.getByText('Il carrello è vuoto')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ambrosia.cart.v1'))).toBe('[]');
  });

  test('current pizza category offers size choices and closing stays closed', async ({ page }) => {
    await page.getByText('Margherita', { exact: true }).last().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Passo 1.*Taglia/)).toBeVisible();
    await expect(dialog.getByText('Piccola', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByPlaceholder('Cerca pizza, bevanda...')).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test('malformed saved cart is discarded and stale checkout step cannot bypass details', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ambrosia.cart.v1', JSON.stringify([{ product: { id: 'bad' }, quantity: 1 }]));
      sessionStorage.setItem('ambrosia.checkout.draft.v1', JSON.stringify({ step: 'payment' }));
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ambrosia.cart.v1'))).toBe('[]');
    await page.getByRole('button', { name: 'Aggiungi Margherita al carrello' }).click();
    await page.goto('/modal');
    await expect(page.getByText('Mangio qui', { exact: true })).toBeVisible();
  });
});
