// Page Objects for Pizzeria Ambrosia (web)
//
// The UI is in Italian and built on react-native-web: interactive controls on
// the login screen are Pressable (div) elements, NOT native <button>s, so they
// are addressed by visible text (getByText), while form fields are real inputs
// (input[type=email|password]) and the product "add" controls are native
// buttons with aria-labels ("Aggiungi <name> al carrello").
import { expect, type Browser, type Locator, type Page } from '@playwright/test';

const GUEST_KEY = 'skibidi_lastLoginAsGuest';
const KIOSK_KEY = 'skibidi_kioskModeEnabled';

// Put the app into guest/kiosk mode via its own state keys. Pressable clicks on
// RN-web are unreliable in headless Chromium (no real pointer capture), so
// seeding localStorage is the deterministic way to reach guest mode.
export async function enterGuestMode(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((keys) => {
    localStorage.setItem(keys[0], 'true');
    localStorage.setItem(keys[1], 'true');
  }, [GUEST_KEY, KIOSK_KEY]);
  await page.goto('/menu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

export class LoginPage {
  readonly page: Page;
  readonly brand: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly fullNameInput: Locator;
  readonly otpButton: Locator;      // "Inviami il codice di accesso" (OTP view)
  readonly passwordViewToggle: Locator; // "Accedi con email e password"
  readonly guestButton: Locator;    // "Entra come ospite"
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.brand = page.getByText('Pizzeria Ambrosia', { exact: true }).first();
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.fullNameInput = page.getByPlaceholder(/Mario Rossi/i);
    this.otpButton = page.getByText(/codice di accesso/i);
    this.passwordViewToggle = page.getByText(/email e password/i);
    this.guestButton = page.getByText(/come ospite/i);
    this.errorMessage = page.locator('.text-destructive');
  }

  async navigate() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await this.emailInput.waitFor({ timeout: 15000 });
  }

  async requestOtpCode(email: string) {
    await this.emailInput.fill(email);
    await this.otpButton.click();
    await this.page.waitForTimeout(1500);
  }

  // Switch from the default OTP view to the email + password view. The toggle
  // only exists in the OTP view, so a tap that a slow render swallows is safe to retry.
  async switchToPasswordView() {
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await this.passwordViewToggle.count()) === 0) break; // already in password view
      await this.passwordViewToggle.click();
      if (await this.passwordInput.isVisible()) return;
      await this.page.waitForTimeout(500);
    }
    await this.passwordInput.waitFor({ timeout: 15000 });
  }

  // shares its label with the form heading, so target the last exact match.
  async submitPassword() {
    await this.page.getByText('Accedi', { exact: true }).last().click();
  }

  // Full email + password login. Returns true if the authenticated menu loaded.
  async login(email: string, password: string): Promise<boolean> {
    await this.switchToPasswordView();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitPassword();
    return this.page
      .getByText('Ordina online')
      .first()
      .waitFor({ timeout: 12000 })
      .then(() => true)
      .catch(() => false);
  }

  async enterGuestMode() {
    await this.navigate();
    await enterGuestMode(this.page);
  }

  async expectError(message: string | RegExp) {
    await expect(this.errorMessage).toContainText(message);
  }
}

export class MenuPage {
  readonly page: Page;
  readonly headerBrand: Locator;
  readonly headerSubtitle: Locator;
  readonly guestBadge: Locator;
  readonly logOutButton: Locator;
  readonly cart: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerBrand = page.getByText('Pizzeria Ambrosia', { exact: true }).first();
    this.headerSubtitle = page.getByText('Ordina online');
    this.guestBadge = page.getByText(/^Ospite$/i);
    this.logOutButton = page.getByText('Esci');
    this.cart = page.getByText('Carrello');
  }

  async navigate() {
    await this.page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await this.headerSubtitle.first().waitFor({ timeout: 15000 });
  }

  // Native product add-buttons: aria-label "Aggiungi <name> al carrello".
  addButtons(): Locator {
    return this.page.getByRole('button', { name: /Aggiungi .*al carrello/i });
  }

  async clickAddButton(index = 0) {
    await this.addButtons().nth(index).click();
  }

  // Native per-product "remove one" stepper buttons: aria-label "Togli una <name>".
  togliButtons(): Locator {
    return this.page.getByRole('button', { name: /^Togli una /i });
  }

  // A category pill by its exact Italian name (e.g. "Pizze Gustose").
  category(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  async addToCart(productName: string) {
    const re = new RegExp(`Aggiungi ${productName} al carrello`, 'i');
    await this.page.getByRole('button', { name: re }).first().click();
  }

  // The menu is loaded when at least one product add-button is available.
  async expectProductsLoaded() {
    await expect(this.addButtons().first()).toBeVisible();
  }

  // Number of items in the cart, read from the CartSummary "N prodotto/i" label.
  async cartCount(): Promise<number> {
    return this.page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(
        (e) => /^\d+ prodotto/i.test((e.textContent || '').trim()),
      );
      const m = (el?.textContent || '').match(/(\d+) prodotto/i);
      return m ? Number(m[1]) : 0;
    });
  }
}

// --- Admin helpers ---------------------------------------------------------
//
// There is no service-role key, so an admin account cannot be seeded from
// tests. These helpers attempt a real login and report success; specs that
// require an admin skip gracefully when no admin account is reachable.

export const ADMIN_EMAIL = process.env.SKIBIDI_ADMIN_EMAIL ?? 'admin@skibidi.com';
export const ADMIN_PASSWORD = process.env.SKIBIDI_ADMIN_PASSWORD ?? 'Admin123!';

export const CUSTOMER_EMAIL = process.env.SKIBIDI_CUSTOMER_EMAIL ?? 'customer@skibidi.com';
export const CUSTOMER_PASSWORD = process.env.SKIBIDI_CUSTOMER_PASSWORD ?? 'Customer123!';

// Try an admin login on a throwaway page; true if it reaches /admin-options.
export async function hasAdminAccount(browser: Browser): Promise<boolean> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  let ok = false;
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ timeout: 15000 });
    await page.getByText(/email e password/i).click();
    await page.waitForTimeout(500);
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByText('Accedi', { exact: true }).last().click();
      ok = await page
        .waitForURL(/menu/, { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
  } catch {
    ok = false;
  } finally {
    await ctx.close();
  }
  return ok;
}

// Log in as admin on the given page; true on success (navigates to dashboard).
export async function loginAsAdmin(page: Page): Promise<boolean> {
  const lp = new LoginPage(page);
  await lp.navigate();
  return lp.login(ADMIN_EMAIL, ADMIN_PASSWORD);
}

// Log in as the known customer; true on success (navigates to /menu).
export async function loginAsCustomer(page: Page): Promise<boolean> {
  const lp = new LoginPage(page);
  await lp.navigate();
  return lp.login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
}
