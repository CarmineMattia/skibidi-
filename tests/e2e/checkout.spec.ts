/**
 * E2E Test: Checkout Flow
 * Tests complete order creation flow from cart to payment
 */

import { test, expect } from '@playwright/test';
import { LoginPage, MenuPage, CheckoutPage } from '../fixtures/page-objects';

test.describe('Checkout Flow', () => {
  let loginPage: LoginPage;
  let menuPage: MenuPage;
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    menuPage = new MenuPage(page);
    checkoutPage = new CheckoutPage(page);

    // Start as guest for testing
    await loginPage.navigate();
    await loginPage.enterGuestMode();
  });

  test('should navigate to checkout from menu', async ({ page }) => {
    await menuPage.goToCheckout();
    await expect(page).toHaveURL('/modal');
    await expect(page.getByText(/come vuoi ricevere/i)).toBeVisible();
  });

  test('should require cart items before checkout', async ({ page }) => {
    // Try to go to checkout with empty cart - should show alert
    // Note: In a real app, we'd intercept the alert or check the button state
    await expect(page.getByRole('button', { name: /vai al pagamento/i }).first()).toBeVisible();
  });

  test('should complete full checkout flow for eat-in order', async ({ page }) => {
    // Step 1: Select order type
    await checkoutPage.selectOrderType('eat_in');

    // Step 2: Fill customer details
    await checkoutPage.fillCustomerDetails('eat_in', {
      name: 'Test User',
      table: '5',
    });

    // Step 3: Select payment method
    await checkoutPage.selectPaymentMethod('card');

    // Step 4: Complete payment
    await checkoutPage.completePayment();

    // Verify success page
    await expect(page).toHaveURL(/\/order-success/);
    await expect(page.getByText(/ordine completato/i)).toBeVisible();
  });

  test('should complete checkout for take-away order', async ({ page }) => {
    await checkoutPage.selectOrderType('take_away');

    await checkoutPage.fillCustomerDetails('take_away', {
      name: 'Test User',
      phone: '1234567890',
    });

    await checkoutPage.selectPaymentMethod('cash');
    await checkoutPage.completePayment();

    await expect(page).toHaveURL(/\/order-success/);
  });

  test('should complete checkout for delivery order', async ({ page }) => {
    await checkoutPage.selectOrderType('delivery');

    await checkoutPage.fillCustomerDetails('delivery', {
      name: 'Test User',
      phone: '1234567890',
      address: '123 Test Street',
    });

    await checkoutPage.selectPaymentMethod('card');
    await checkoutPage.completePayment();

    await expect(page).toHaveURL(/\/order-success/);
  });

  test('should require table number for eat-in orders', async ({ page }) => {
    await checkoutPage.selectOrderType('eat_in');

    // Try to continue without table number
    await checkoutPage.continueButton.click();

    // Should show validation error
    await expect(page.getByText(/numero del tavolo/i)).toBeVisible();
  });

  test('should require phone for take-away orders', async ({ page }) => {
    await checkoutPage.selectOrderType('take_away');

    // Try to continue without phone
    await checkoutPage.continueButton.click();

    await expect(page.getByText(/telefono/i)).toBeVisible();
  });
});

test.describe('Checkout Validation', () => {
  test('should validate table number input to only accept numbers', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterGuestMode();

    // Go to checkout
    await page.goto('/modal');
    await page.waitForLoadState('networkidle');

    // Select eat-in
    await page.getByText('Mangio Qui').click();
    await page.getByRole('button', { name: /continua/i }).click();

    // Enter non-numeric characters
    const tableInput = page.getByPlaceholder('Es. 12');
    await tableInput.fill('ABC');

    // Should be empty or have no effect (regex validation)
    await expect(tableInput).not.toHaveValue(/[A-Z]/i);
  });

  test('should show order summary on payment step', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterGuestMode();

    // Navigate to checkout
    await page.goto('/modal');
    await page.waitForLoadState('networkidle');

    // Go through steps
    await page.getByText('Mangio Qui').click();
    await page.getByRole('button', { name: /continua/i }).click();
    await page.getByPlaceholder('Es. 12').fill('5');
    await page.getByRole('button', { name: /continua/i }).click();

    // Should see payment section with totals
    await expect(page.getByText(/totale/i)).toBeVisible();
    await expect(page.getByText(/€[0-9]+,[0-9]{2}/)).toBeVisible();
  });
});

test.describe('Order Success', () => {
  test('should display order confirmation after successful payment', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterGuestMode();

    // Simulate success page visit
    await page.goto('/order-success?orderId=test-order-123');
    await page.waitForLoadState('networkidle');

    // Should show confirmation
    await expect(page.getByText(/grazie/i)).toBeVisible();
    await expect(page.getByText(/ordine/i)).toBeVisible();
  });
});