/**
 * E2E Test: Authentication Flow
 * Tests the OTP-first login, email+password login, signup, guest mode, and
 * logout.
 *
 * The login screen defaults to a passwordless OTP view ("Inviami il codice di
 * accesso") with an "Accedi con email e password" switch to the classic form.
 * The UI is in Italian and built on react-native-web: the interactive controls
 * are Pressable divs (not native buttons), so they are addressed by visible
 * text, while the form fields are real inputs.
 */
import { test, expect } from '@playwright/test';
import { LoginPage, MenuPage, enterGuestMode } from '../fixtures/page-objects';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should display login form correctly', async ({ page }) => {
    await expect(page.getByText('Pizzeria Ambrosia')).not.toHaveCount(0);
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.otpButton).toBeVisible();
    await expect(page.getByText(/niente password/i)).toBeVisible();
  });

  test('should switch between the OTP and email+password views', async ({ page }) => {
    // Default view is OTP
    await expect(loginPage.otpButton).toBeVisible();
    await expect(loginPage.passwordInput).toHaveCount(0);
    // Switch to email + password
    await loginPage.switchToPasswordView();
    await expect(loginPage.passwordInput).toBeVisible();
    // And back to OTP
    await page.getByText(/torna all'accesso con codice/i).click();
    await expect(loginPage.passwordInput).toHaveCount(0);
    await expect(loginPage.otpButton).toBeVisible();
  });

  test('should reveal signup fields in registration mode', async ({ page }) => {
    await loginPage.switchToPasswordView();
    await page.getByText('Registrati', { exact: true }).first().click();
    await expect(loginPage.fullNameInput).toBeVisible();
    await expect(page.getByText('Ruolo', { exact: true })).toBeVisible();
  });

  test('should show validation error for empty fields', async () => {
    await loginPage.switchToPasswordView();
    await loginPage.submitPassword();
    await loginPage.expectError(/Inserisci email e password/i);
  });

  test('should show validation error for invalid email format', async () => {
    await loginPage.switchToPasswordView();
    await loginPage.emailInput.fill('invalid-email');
    await loginPage.passwordInput.fill('Password123!');
    await loginPage.submitPassword();
    await loginPage.expectError(/indirizzo email valido/i);
  });

  test('should show validation error for short password', async () => {
    await loginPage.switchToPasswordView();
    await loginPage.emailInput.fill('test@example.com');
    await loginPage.passwordInput.fill('12345');
    await loginPage.submitPassword();
    await loginPage.expectError(/almeno 6 caratteri/i);
  });

  test('should display an error for unknown credentials', async ({ page }) => {
    await loginPage.switchToPasswordView();
    await loginPage.emailInput.fill('nonexistent@example.com');
    await loginPage.passwordInput.fill('WrongPassword1!');
    await loginPage.submitPassword();
    await expect(page.locator('.text-destructive').first()).toBeVisible();
  });
});

test.describe('Guest Mode', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page);
  });

  test('should allow guest to browse menu and add items to cart', async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.expectProductsLoaded();
    await menu.clickAddButton(0);
    await expect(page.getByText('Carrello').first()).toBeVisible();
  });

  test('should show a guest identifier in the header', async ({ page }) => {
    const menu = new MenuPage(page);
    await expect(menu.guestBadge.first()).toBeVisible();
  });
});

test.describe('Logout', () => {
  test('should log out and return to the login page', async ({ page }) => {
    await enterGuestMode(page);
    const menu = new MenuPage(page);
    await expect(menu.logOutButton).toBeVisible();
    await menu.logOutButton.click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
