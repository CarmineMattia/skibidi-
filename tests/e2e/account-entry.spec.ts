/**
 * E2E (locale, backend finto): login solo Google, quindi niente voce "Ospite"
 * né "Accedi o Registrati". Da non loggato si vede solo "Accedi con Google";
 * da loggato il nome, l'account e "Esci".
 */
import { expect, test, type Page } from '@playwright/test';
import { mockEmptyBackend } from './fixtures/mockBackend';
import { mockLoggedInCustomer } from './fixtures/mockSession';

const gone = async (page: Page) => {
  await expect(page.getByText(/^Ospite$/i)).toHaveCount(0);
  await expect(page.getByText(/Registrati/i)).toHaveCount(0);
  await expect(page.getByText(/^Guest$/i)).toHaveCount(0);
};

test.describe('Account entry (Google only)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('logged out: menu header, side menu and tab bar offer only Google sign-in', async ({ page }) => {
    await mockEmptyBackend(page);
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Il mio account')).toHaveCount(0);
    await expect(page.getByText('Esci')).toHaveCount(0);
    await gone(page);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Accedi con Google').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Esci')).toHaveCount(0);
    await expect(page.getByText('Kiosk')).toHaveCount(0);
    await gone(page);
  });

  test('logged in: name, account and sign-out, no Google sign-in', async ({ page }) => {
    await mockEmptyBackend(page);
    await mockLoggedInCustomer(page);
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Il mio account').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Cliente').first()).toBeVisible();
    await expect(page.getByText('Esci').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi con Google' })).toHaveCount(0);
    await gone(page);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('cliente.e2e@example.com')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Accedi con Google')).toHaveCount(0);
    await gone(page);
  });
});
