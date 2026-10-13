import { expect, test } from '@playwright/test';

const categories = [
  { id: 'pizza-category', name: 'Classiche', active: true, display_order: 1 },
  { id: 'drinks-category', name: 'Bevande', active: true, display_order: 2 },
];
const products = [
  { id: 'pizza-product', category_id: 'pizza-category', name: 'Margherita', description: 'Pomodoro e mozzarella', price: 5, ingredients: ['pomodoro', 'mozzarella'], active: true, display_order: 1 },
  { id: 'drink-product', category_id: 'drinks-category', name: 'Acqua', description: null, price: 1, ingredients: [], active: true, display_order: 2 },
];

const cartCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    (JSON.parse(localStorage.getItem('ambrosia.cart.v1') || '[]') as { quantity: number }[]).reduce(
      (sum, item) => sum + item.quantity,
      0
    )
  );

test.describe('upsell bevande', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('il primo tap su una bevanda evidenziata la aggiunge subito', async ({ page }) => {
    await page.route('**/rest/v1/products?**', (route) => route.fulfill({ json: products }));
    await page.route('**/rest/v1/categories?**', (route) => route.fulfill({ json: categories }));
    // Nessun ordine reale: tutte le mutazioni backend sono bloccate.
    await page.route('**/rest/v1/rpc/**', (route) => route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }));
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }));
    await page.goto('/menu');
    await expect(page.getByPlaceholder('Cerca pizza, bevanda...')).toBeVisible();

    await page.getByRole('button', { name: 'Aggiungi Margherita al carrello' }).click();
    await expect.poll(() => cartCount(page)).toBe(1);

    // Il checkout senza bevande apre l'upsell sulla categoria Bevande.
    await page.getByRole('button', { name: /Carrello: 1/ }).click();
    await page.getByText(/Procedi/).first().click();
    await expect(page.getByText('Scegli una bevanda!')).toBeVisible();

    // Un solo tap sul "+" della bevanda: deve finire nel carrello.
    await page.getByRole('button', { name: 'Aggiungi Acqua al carrello' }).tap({ timeout: 3000 });
    await expect.poll(() => cartCount(page), { timeout: 2000 }).toBe(2);
    await expect(page.getByText('Scegli una bevanda!')).toBeHidden();
  });

  test('dall\'upsell si prosegue al checkout con un solo tap', async ({ page }) => {
    await page.route('**/rest/v1/products?**', (route) => route.fulfill({ json: products }));
    await page.route('**/rest/v1/categories?**', (route) => route.fulfill({ json: categories }));
    await page.route('**/rest/v1/rpc/**', (route) => route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }));
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }));
    await page.goto('/menu');
    await page.getByRole('button', { name: 'Aggiungi Margherita al carrello' }).tap();
    await page.getByRole('button', { name: /Carrello: 1/ }).tap();
    await page.getByText(/Procedi/).first().tap();
    await expect(page.getByText('Scegli una bevanda!')).toBeVisible();

    // Il fumetto resta finché il cliente non decide (niente auto-chiusura dopo 4s).
    await page.waitForTimeout(4500);
    await expect(page.getByText('Scegli una bevanda!')).toBeVisible();

    await page.getByRole('button', { name: 'Continua senza' }).tap();
    await expect(page).toHaveURL(/\/modal/);
  });
});
