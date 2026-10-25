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

    await expect(page.getByText('Orari di apertura')).toBeAttached();
    await expect(page.getByText('0522 171 7681').first()).toBeVisible();
  });

  test('barra in alto: solo Menu, Offerte e Chiama', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Menu', exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Offerte', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chiama ora 0522 171 7681' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gallery' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Contatti', exact: true })).toHaveCount(0);
  });

  test('WhatsApp visibile subito accanto a "Ordina le pizze"', async ({ page }) => {
    const wa = page.getByRole('link', { name: 'Scrivici su WhatsApp' });
    await wa.waitFor({ timeout: 15_000 });
    await expect(wa).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Ordina le pizze' })).toBeInViewport();

    await page.context().route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'ok' }));
    const popupPromise = page.context().waitForEvent('page');
    await wa.click();
    const popup = await popupPromise;
    expect(popup.url()).toContain('https://wa.me/3905221717681');
  });

  test('porta dal hero al menu ordini', async ({ page }) => {
    const hero = page.getByRole('button', { name: 'Ordina le pizze' });
    await hero.waitFor({ timeout: 15_000 });
    await hero.click();
    await expect(page).toHaveURL(/\/menu(?:\?.*)?$/, { timeout: 15_000 });
  });
});
