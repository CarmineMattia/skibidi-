// Page Objects for Pizzeria Ambrosia (web)
//
// The UI is in Italian and built on react-native-web: interactive controls on
// the login screen are Pressable (div) elements, NOT native <button>s, so they
// are addressed by visible text (getByText), while form fields are real inputs
// (input[type=email|password]) and the product "add" controls are native
// buttons with aria-labels ("Aggiungi <name> al carrello").
import { expect, type Browser, type Locator, type Page } from '@playwright/test';

// Ordinare richiede il login Google; senza sessione il menu resta navigabile.
// Apre il menu da utente non loggato (ex "modalità ospite", rimossa).
export async function openMenuLoggedOut(page: Page) {
  await page.goto('/menu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

export class LoginPage {
  readonly page: Page;
  readonly brand: Locator;
  readonly googleButton: Locator;   // "Continua con Google"
  readonly emailInput: Locator;     // solo nel login admin nascosto (/login?admin=1)
  readonly passwordInput: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.brand = page.getByText('Pizzeria Ambrosia', { exact: true }).first();
    this.googleButton = page.getByText('Continua con Google');
    this.emailInput = page.getByPlaceholder('Email admin');
    this.passwordInput = page.locator('input[type="password"]');
    this.errorMessage = page.locator('.text-destructive');
  }

  async navigate() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await this.googleButton.first().waitFor({ timeout: 15000 });
  }

  // Login admin email+password: esiste solo se l'app è buildata con
  // EXPO_PUBLIC_ENABLE_ADMIN_PASSWORD_LOGIN=true. Ritorna true se arriva al menu.
  async adminLogin(email: string, password: string): Promise<boolean> {
    await this.page.goto('/login?admin=1', { waitUntil: 'domcontentloaded' });
    const available = await this.emailInput
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!available) return false;
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.page.getByText('Accedi come admin').click();
    return this.page
      .waitForURL(/menu/, { timeout: 12000 })
      .then(() => true)
      .catch(() => false);
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


// Try an admin login on a throwaway page; true if it reaches the menu.
export async function hasAdminAccount(browser: Browser): Promise<boolean> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    return await new LoginPage(page).adminLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch {
    return false;
  } finally {
    await ctx.close();
  }
}

// Log in as admin on the given page; true on success (needs the admin flag).
export async function loginAsAdmin(page: Page): Promise<boolean> {
  return new LoginPage(page).adminLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
}

// I clienti entrano solo con Google OAuth, non automatizzabile qui:
// le spec che ne hanno bisogno vengono saltate.
export async function loginAsCustomer(_page: Page): Promise<boolean> {
  return false;
}
