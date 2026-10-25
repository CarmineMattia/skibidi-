import { expect, test } from '@playwright/test';

// Same category names and DB display_order as prod (2026-10-25): Bevande and Dolci come first in the DB.
const categories = [
  { id: 'bev', name: 'Bevande', active: true, display_order: 1 },
  { id: 'dol', name: 'Dolci', active: true, display_order: 2 },
  { id: 'gou', name: 'Gourmet', active: true, display_order: 3 },
  { id: 'gus', name: 'Gustose', active: true, display_order: 4 },
  { id: 'bia', name: 'Bianche', active: true, display_order: 5 },
  { id: 'cla', name: 'Classiche', active: true, display_order: 6 },
  { id: 'met', name: 'Al metro', active: true, display_order: 7 },
];
const photo = 'https://e2e-placeholder.supabase.co/storage/v1/object/public/product-images/x.webp';
const product = (id: string, name: string, category_id: string, display_order: number, price: number) => ({
  id, name, category_id, display_order, price, description: null, ingredients: [], active: true, image_url: photo,
});
const products = [
  product('p-prof', 'Profiterol', 'dol', 1, 4),
  product('p-coca', 'Coca Cola', 'bev', 2, 2.5),
  product('p-rust', 'La Rustica', 'gou', 3, 11),
  product('p-marg', 'Margherita', 'cla', 4, 5),
  product('p-bian', 'Bianca', 'bia', 5, 5),
];

test.describe('pizzas first', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    await page.route('**/storage/v1/object/public/**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.route('**/rest/v1/products?**', (route) => route.fulfill({ json: products }));
    await page.route('**/rest/v1/categories?**', (route) => route.fulfill({ json: categories }));
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, json: { error: 'Test: no backend mutations' } }));
  });

  test('menu opens on the "Pizze" chip, Classiche first, desserts and drinks last', async ({ page }) => {
    await page.goto('/menu');
    await expect(page.getByRole('button', { name: 'Aggiungi Margherita al carrello' })).toBeVisible();
    const chipNames = ['Pizze', 'Classiche', 'Bianche', 'Gustose', 'Gourmet', 'Al metro', 'Dolci', 'Bevande'];
    const boxes = [];
    for (const name of chipNames) {
      const chip = page.getByRole('button', { name, exact: true }).first();
      await expect(chip).toBeAttached();
      boxes.push((await chip.boundingBox())!.x);
    }
    expect([...boxes].sort((a, b) => a - b)).toEqual(boxes);
    // Default list: pizzas only, Margherita (Classiche) before La Rustica (Gourmet).
    await expect(page.getByRole('button', { name: 'Aggiungi Profiterol al carrello' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Aggiungi Coca Cola al carrello' })).toHaveCount(0);
    const marg = (await page.getByRole('button', { name: 'Aggiungi Margherita al carrello' }).boundingBox())!.y;
    const rust = (await page.getByRole('button', { name: 'Aggiungi La Rustica al carrello' }).boundingBox())!.y;
    expect(marg).toBeLessThan(rust);
    await page.getByRole('button', { name: 'Dolci', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Aggiungi Profiterol al carrello' })).toBeVisible();
  });

  test('home shows "Ordina le pizze" and the pizza strip above the fold', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('button', { name: 'Ordina le pizze' });
    await expect(cta).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Margherita: apri il menu' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Profiterol: apri il menu' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Margherita: apri il menu' }).click();
    await expect(page).toHaveURL(/\/menu(?:\?.*)?$/);
  });
});
