import { expect, test } from '@playwright/test';

test.describe('Landing Ambrosia', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('mostra identità, servizi e contatti pubblici', async ({ page }) => {
    await expect(page.getByText('Il nettare', { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Tradizione nel forno', { exact: false })).toBeVisible();
    await expect(page.getByText('€2,50').first()).toBeVisible();

    await page.getByRole('link', { name: 'Orari e contatti' }).click();
    await expect(page.getByText('Orari di apertura')).toBeVisible();
    await expect(page.getByText('0522 171 7681')).toBeVisible();
  });

  test('porta dal hero al menu ordini', async ({ page }) => {
    await page.getByRole('button', { name: 'Ordina dal menu' }).click();
    await expect(page).toHaveURL(/\/menu(?:\?.*)?$/, { timeout: 15_000 });
  });

  test('usa la navigazione marketing su desktop', async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 768,
      'La navigazione mobile usa la tab bar dell’app',
    );

    await expect(page.getByRole('link', { name: 'Gallery' })).toBeVisible();
    await page.getByRole('link', { name: 'Gallery' }).click();
    await expect(page.getByText('Un ambiente', { exact: false })).toBeInViewport();
  });
});
