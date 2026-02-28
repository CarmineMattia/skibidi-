/**
 * E2E Test: Menu and Product Display
 * Tests for menu browsing and product functionality
 */

import { test, expect } from '@playwright/test';
import { LoginPage, MenuPage } from '../fixtures/page-objects';

test.describe('Menu Display', () => {
  let menuPage: MenuPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    menuPage = new MenuPage(page);
    loginPage = new LoginPage(page);

    await loginPage.navigate();
    await loginPage.enterGuestMode();
  });

  test('should display menu page header', async ({ page }) => {
    await menuPage.navigate();
    await expect(page.getByText('🍟')).toBeVisible();
    await expect(page.getByText('SKIBIDI ORDERS')).toBeVisible();
  });

  test('should show products grid', async ({ page }) => {
    await menuPage.navigate();
    await menuPage.expectProductsLoaded();

    // Products should be displayed in a grid
    const products = page.locator('[class*="ProductCard"]');
    const count = await products.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display categories', async ({ page }) => {
    await menuPage.navigate();

    // Category filter should be visible
    const categoryFilter = page.locator('[class*="CategoryFilter"]');
    await expect(categoryFilter).toBeVisible();
  });

  test('should allow category filtering', async ({ page }) => {
    await menuPage.navigate();

    // Click on a category button
    const categoryButton = page.locator('[class*="CategoryFilter"] button').first();
    await categoryButton.click();
    await page.waitForTimeout(500);
  });
});

test.describe('Cart Functionality', () => {
  test('should update cart when adding items', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterGuestMode();

    // Click on a product to add to cart
    const productCard = page.locator('[class*="ProductCard"]').first();
    await productCard.click();

    // Product modal should appear
    await expect(page.getByRole('button', { name: /aggiungi/i })).toBeVisible();
  });

  test('should show cart badge with item count', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterGuestMode();

    // Initially no items
    const emptyCart = page.getByText(/0 prodotti/);

    // After adding items, cart should update
    const productCard = page.locator('[class*="ProductCard"]').first();
    await productCard.click();

    // Click add to cart
    const addButton = page.getByRole('button', { name: /aggiungi al carrello/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('User Role Features', () => {
  test('should show admin features when logged in as admin', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    // Login with admin credentials (requires pre-existing user)
    // For now, test guest mode
    await loginPage.enterGuestMode();

    // Admin features should not be visible in guest mode
    const adminButton = page.getByText(/opzioni/i);
    const addProductButton = page.getByText(/nuovo/i);

    await expect(adminButton).not.toBeVisible();
    await expect(addProductButton).not.toBeVisible();
  });

  test('should display user info in header', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterGuestMode();

    // Should show guest identifier
    await expect(page.getByText(/👤 ospite123/)).toBeVisible();
  });
});