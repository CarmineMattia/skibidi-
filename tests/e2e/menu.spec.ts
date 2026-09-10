/**
 * E2E Test: Menu — guest browsing, category filter, and cart summary.
 *
 * A guest (kiosk) user lands on the menu and can browse the Italian menu,
 * see the category filter, and view the cart summary.
 */

import { test, expect } from '@playwright/test';
import { MenuPage, enterGuestMode } from '../fixtures/page-objects';

test.describe('Menu (guest)', () => {
  let menu: MenuPage;

  test.beforeEach(async ({ page }) => {
    menu = new MenuPage(page);
    await enterGuestMode(page);
  });

  test('1. Menu shows products', async () => {
    await expect(menu.guestBadge.first()).toBeVisible({ timeout: 15000 });
    await menu.expectProductsLoaded();
  });

  test('2. Category filter is visible', async () => {
    await menu.expectProductsLoaded();
    await expect(menu.category('Bevande')).toBeVisible();
    await expect(menu.category('Pizze Gustose')).toBeVisible();
  });

  test('3. Cart summary is visible', async () => {
    await menu.expectProductsLoaded();
    await expect(menu.cart.first()).toBeVisible();
  });

  test('4. Guest badge is visible', async () => {
    await expect(menu.guestBadge.first()).toBeVisible({ timeout: 15000 });
  });
});
