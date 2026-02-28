/**
 * Page Objects
 * Reusable page interaction utilities for E2E tests
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signupTab: Locator;
  readonly guestModeButton: Locator;
  readonly errorMessage: Locator;
  readonly fullNameInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByPlaceholder('esempio@email.com');
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.loginButton = page.getByRole('button', { name: /accedi/i });
    this.signupTab = page.getByRole('button', { name: /registrati/i });
    this.guestModeButton = page.getByRole('button', { name: /entra come ospite/i });
    this.errorMessage = page.locator('[class*="text-destructive"]');
    this.fullNameInput = page.getByPlaceholder('Mario Rossi');
  }

  async navigate() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL(/\(tabs\)\/menu/);
  }

  async clickSignupTab() {
    await this.signupTab.click();
  }

  async signup(email: string, password: string, fullName: string, role: string) {
    await this.clickSignupTab();
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForTimeout(1000);
  }

  async enterGuestMode() {
    await this.guestModeButton.click();
    await this.page.waitForURL(/\(tabs\)\/menu/);
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

export class MenuPage {
  readonly page: Page;
  readonly products: Locator;
  readonly cartBadge: Locator;
  readonly checkoutButton: Locator;
  readonly logoutButton: Locator;
  readonly categoryButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.products = page.locator('[class*="ProductCard"]');
    this.cartBadge = page.locator('[class*="cart"]');
    this.checkoutButton = page.getByRole('button', { name: /vai al pagamento|checkout/i }).first();
    this.logoutButton = page.getByRole('button', { name: /esci|logout/i }).first();
    this.categoryButtons = page.locator('[class*="CategoryFilter"] button');
  }

  async navigate() {
    await this.page.goto('/(tabs)/menu');
    await this.page.waitForLoadState('networkidle');
  }

  async addProductToCart(productName: string) {
    const product = this.page.getByText(productName).first();
    await product.click();
    await this.page.waitForTimeout(500);
  }

  async goToCheckout() {
    await this.checkoutButton.click();
    await this.page.waitForURL('/modal');
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('/login');
  }

  async expectProductsLoaded() {
    await expect(this.products.first()).toBeVisible({ timeout: 10000 });
  }
}

export class CheckoutPage {
  readonly page: Page;
  readonly orderTypeButtons: Locator;
  readonly continueButton: Locator;
  readonly nameInput: Locator;
  readonly tableInput: Locator;
  readonly phoneInput: Locator;
  readonly paymentButton: Locator;
  readonly cardPayment: Locator;
  readonly cashPayment: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orderTypeButtons = page.locator('[class*="order-type"]');
    this.continueButton = page.getByRole('button', { name: /continua|vai al pagamento/i });
    this.nameInput = page.getByPlaceholder('Il tuo nome');
    this.tableInput = page.getByPlaceholder('Es. 12');
    this.phoneInput = page.getByPlaceholder('Il tuo numero');
    this.paymentButton = page.getByRole('button', { name: /paga ora/i });
    this.cardPayment = page.getByText(/carta di credito/i);
    this.cashPayment = page.getByText(/contanti/i);
  }

  async selectOrderType(type: 'eat_in' | 'take_away' | 'delivery') {
    const typeMap = {
      eat_in: 'Mangio Qui',
      take_away: 'Da Asporto',
      delivery: 'Delivery',
    };
    await this.page.getByText(typeMap[type]).click();
    await this.continueButton.click();
  }

  async fillCustomerDetails(type: 'eat_in' | 'take_away' | 'delivery', details: { name: string; table?: string; phone?: string; address?: string }) {
    if (type === 'eat_in' && details.table) {
      await this.tableInput.fill(details.table!);
    }
    if ((type === 'take_away' || type === 'delivery') && details.phone) {
      await this.phoneInput.fill(details.phone!);
    }
    await this.continueButton.click();
  }

  async selectPaymentMethod(method: 'card' | 'cash') {
    if (method === 'card') {
      await this.cardPayment.click();
    } else {
      await this.cashPayment.click();
    }
  }

  async completePayment() {
    await this.paymentButton.click();
    await this.page.waitForURL(/\/order-success/);
  }
}

export class KitchenPage {
  readonly page: Page;
  readonly orders: Locator;
  readonly readyButton: Locator;
  readonly deliveredButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orders = page.locator('[class*="KitchenOrder"]');
    this.readyButton = page.getByRole('button', { name: /pronto/i });
    this.deliveredButton = page.getByRole('button', { name: /consegnato/i });
  }

  async navigate() {
    await this.page.goto('/(tabs)/kitchen');
    await this.page.waitForLoadState('networkidle');
  }

  async expectOrdersLoaded() {
    await expect(this.orders.first()).toBeVisible({ timeout: 10000 });
  }

  async markOrderReady() {
    await this.readyButton.first().click();
    await this.page.waitForTimeout(500);
  }

  async markOrderDelivered() {
    await this.deliveredButton.first().click();
    await this.page.waitForTimeout(500);
  }
}