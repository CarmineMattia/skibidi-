/**
 * E2E Test: User / Kiosk Flow — a guest browses the menu and adds to the cart.
 *
 * This is the core customer journey: the menu loads with products and
 * categories, and adding a product updates the cart.
 */

import { test, expect } from '@playwright/test';
import { MenuPage, enterGuestMode } from '../fixtures/page-objects';

test.describe('User / Kiosk Flow', () => {
  let menu: MenuPage;

  test.beforeEach(async ({ page }) => {
    menu = new MenuPage(page);
    await enterGuestMode(page);
  });

  test('1. Menu shows products and categories', async () => {
    await expect(menu.guestBadge.first()).toBeVisible({ timeout: 15000 });
    await menu.expectProductsLoaded();
    await expect(menu.category('Bevande')).toBeVisible();
  });

  test('2. Guest can add a product to the cart', async () => {
    await menu.expectProductsLoaded();
    await menu.addButtons().first().click();
    await expect
      .poll(() => menu.cartCount(), { timeout: 5000, message: 'cart count should increase' })
      .toBeGreaterThan(0);
  });

  test('3. Cart summary shows a total after adding an item', async ({ page }) => {
    await menu.expectProductsLoaded();
    await menu.addButtons().first().click();
    await expect(page.getByText('Totale').first()).toBeVisible({ timeout: 5000 });
  });
});
