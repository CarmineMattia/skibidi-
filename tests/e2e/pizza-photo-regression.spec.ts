import { expect, test } from '@playwright/test';
import manifest from '../../assets/images/products/pizza-photo-manifest.json';
import { createHash } from 'node:crypto';
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
