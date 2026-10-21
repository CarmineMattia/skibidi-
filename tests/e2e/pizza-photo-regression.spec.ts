import { expect, test } from '@playwright/test';
import manifest from '../../assets/images/products/pizza-photo-manifest.json';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const uuid = (value: string) => createHash('md5').update(value).digest('hex').replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
test.use({ viewport: { width: 390, height: 844 } });
test('the 48 recipe photos load independently of the unavailable backend', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 503, json: { message: 'unavailable' } }));
  await page.goto('/pizza-foto');
  const images = page.locator('img[src*="generated-v"]');
  await expect(images).toHaveCount(48);
  await expect.poll(() => images.evaluateAll(nodes => nodes.filter(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0).length)).toBe(48);
  await page.screenshot({ path: 'test-results/pizza-photo-catalog-mobile.png' });
});
test('menu shows the matching Diavola image for the seeded recipe', async ({ page }) => {
  const pizza = manifest.recipes.find(recipe => recipe.name === 'Diavola')!;
  const category = uuid('ambrosia:category:Classiche');
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/categories?**', route => route.fulfill({ json: [{ id: category, name: 'Classiche', active: true, display_order: 1 }] }));
  await page.route('**/rest/v1/products?**', route => route.fulfill({ json: [{ id: pizza.id, category_id: category, name: pizza.name, description: pizza.recipe, image_url: null, price: 6.5, active: true, display_order: 1 }] }));
  await page.goto('/menu');
  await expect(page.getByRole('button', { name: 'Aggiungi Diavola al carrello' })).toBeVisible();
  const image = page.locator('img[src*="diavola-generated-v1"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/pizza-photo-menu-mobile.png' });
});
test('a Supabase Storage photo wins over the bundled one; drinks keep their image_url', async ({ page }) => {
  // Hermetic: every backend and image request is mocked, no real host is reached.
  const margherita = manifest.recipes.find(recipe => recipe.name === 'Margherita')!;
  const pizzas = uuid('ambrosia:category:Classiche');
  const drinks = uuid('ambrosia:category:Bevande');
  const storageUrl = 'https://e2e-placeholder.supabase.co/storage/v1/object/public/products/ambrosia/margherita.jpg';
  const drinkUrl = 'https://images.unsplash.com/photo-e2e-coca?w=800';
  const photo = readFileSync('assets/images/landing/margherita.jpeg');
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/storage/v1/object/public/**', route => route.fulfill({ body: photo, contentType: 'image/jpeg' }));
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ body: photo, contentType: 'image/jpeg' }));
  await page.route('**/rest/v1/categories?**', route => route.fulfill({ json: [
    { id: pizzas, name: 'Classiche', active: true, display_order: 1 },
    { id: drinks, name: 'Bevande', active: true, display_order: 2 },
  ] }));
  await page.route('**/rest/v1/products?**', route => route.fulfill({ json: [
    { id: margherita.id, category_id: pizzas, name: margherita.name, description: margherita.recipe, image_url: storageUrl, price: 5, active: true, display_order: 1 },
    { id: uuid('ambrosia:product:Coca Cola'), category_id: drinks, name: 'Coca Cola', description: null, image_url: drinkUrl, price: 3, active: true, display_order: 2 },
  ] }));
  await page.goto('/menu');
  await expect(page.getByRole('button', { name: 'Aggiungi Margherita al carrello' })).toBeVisible();
  const real = page.locator(`img[src="${storageUrl}"]`).first();
  await expect(real).toBeVisible();
  await expect.poll(() => real.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('img[src*="margherita-generated-v1"]')).toHaveCount(0);
  await expect(page.locator(`img[src="${drinkUrl}"]`).first()).toBeAttached();
  await page.screenshot({ path: 'test-results/storage-photo-menu-mobile.png' });
});
