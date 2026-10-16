/**
 * E2E Test: Authentication Flow (solo Google)
 * Il login è solo Google OAuth: niente email+password, niente codice OTP,
 * niente modalità ospite. Il menu resta navigabile senza login, ma il
 * checkout richiede un utente autenticato.
 */
import { test, expect } from '@playwright/test';
import { LoginPage, MenuPage, openMenuLoggedOut } from '../fixtures/page-objects';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('shows only the Google sign-in option', async ({ page }) => {
    await expect(page.getByText('Pizzeria Ambrosia')).not.toHaveCount(0);
    await expect(loginPage.googleButton).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText(/come ospite/i)).toHaveCount(0);
    await expect(page.getByText(/codice di accesso/i)).toHaveCount(0);
  });

  test('hidden admin login is off unless the build flag is set', async ({ page }) => {
    test.skip(process.env.EXPO_PUBLIC_ENABLE_ADMIN_PASSWORD_LOGIN === 'true', 'admin flag on');
    await page.goto('/login?admin=1', { waitUntil: 'domcontentloaded' });
    await loginPage.googleButton.first().waitFor({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('shows the provider error returned in the redirect URL', async ({ page }) => {
    await page.goto('/login?error=access_denied&error_description=denied', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText(/Accesso annullato/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Logged-out browsing', () => {
  test('menu is browsable and items can be added without login', async ({ page }) => {
    await openMenuLoggedOut(page);
    const menu = new MenuPage(page);
    await menu.expectProductsLoaded();
    await menu.clickAddButton(0);
    await expect(page.getByText('Carrello').first()).toBeVisible();
  });

  test('checkout route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/modal', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(new LoginPage(page).googleButton).toBeVisible();
  });
});
