import { expect, test, type Page } from '@playwright/test';
import { mockLoggedInAdmin, MOCK_COMPANY_ID } from './fixtures/mockSession';

/**
 * Editor prodotto dell'admin: salvare una modifica invia solo i campi cambiati.
 * Prima il salvataggio mandava sempre active: true, display_order: 0 e gli ingredienti del form,
 * riattivando i prodotti spenti. Tutto con mock: nessuna scrittura reale.
 */
const CATEGORY = '0f0f0f0f-0000-4000-8000-000000000001';
const PRODUCT = {
  id: '0f0f0f0f-0000-4000-8000-000000000002',
  category_id: CATEGORY,
  company_id: MOCK_COMPANY_ID,
  name: 'Bufalina E2E',
  description: 'pomodoro, bufala',
  price: 8.5,
  image_url: null,
  ingredients: ['pomodoro', 'bufala'],
  active: false,
  display_order: 7,
};

async function openEditor(page: Page) {
  const patches: unknown[] = [];
  const inserts: unknown[] = [];
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/categories?**', (route) =>
    route.fulfill({ json: [{ id: CATEGORY, name: 'Classiche', active: true, display_order: 1, company_id: MOCK_COMPANY_ID }] })
  );
  await page.route('**/rest/v1/products?**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      patches.push(route.request().postDataJSON());
      return route.fulfill({ status: 204, body: '' });
    }
    if (method === 'POST') {
      inserts.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, body: '' });
    }
    return route.fulfill({ json: [PRODUCT] });
  });
  await mockLoggedInAdmin(page);
  await page.goto('/menu');
  const edit = page.getByRole('button', { name: `Modifica ${PRODUCT.name}` });
  await expect(edit).toBeVisible({ timeout: 20000 });
  await edit.click();
  const price = page.getByLabel('Prezzo prodotto');
  await expect(price).toHaveValue('8.5');
  return { patches, inserts, price };
}

test('cambiare il prezzo invia solo il prezzo: il prodotto spento resta spento', async ({ page }) => {
  const { patches, inserts, price } = await openEditor(page);
  await price.fill('9,00');
  await page.getByRole('button', { name: 'Salva Modifiche' }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ price: 9 });
  expect(inserts).toEqual([]);
});

test('salvare senza modifiche non scrive nulla', async ({ page }) => {
  const { patches, inserts } = await openEditor(page);
  await page.getByRole('button', { name: 'Salva Modifiche' }).click();
  await page.waitForTimeout(1000);
  expect(patches).toEqual([]);
  expect(inserts).toEqual([]);
});
