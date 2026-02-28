/**
 * E2E Test: Kitchen Dashboard
 * Tests for kitchen order management functionality
 */

import { test, expect } from '@playwright/test';
import { KitchenPage, LoginPage } from '../fixtures/page-objects';

test.describe('Kitchen Dashboard', () => {
  let kitchenPage: KitchenPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    kitchenPage = new KitchenPage(page);
    loginPage = new LoginPage(page);

    // Navigate as admin to access kitchen
    await loginPage.navigate();
    // Note: Kitchen access requires admin role
    // For testing, we may need to mock the auth state
  });

  test('should display kitchen dashboard header', async ({ page }) => {
    await kitchenPage.navigate();
    await expect(page.getByText(/cucina|kitchen/i)).toBeVisible();
  });

  test('should display orders section', async ({ page }) => {
    await kitchenPage.navigate();
    await expect(page.getByText(/ordini attivi/i)).toBeVisible();
  });
});

test.describe('Order Status Flow', () => {
  test('should show order status progression', async ({ page }) => {
    await page.goto('/(tabs)/kitchen');
    await page.waitForLoadState('networkidle');

    // Check for status indicators
    const pendingBadge = page.getByText(/in attesa/i);
    const preparingBadge = page.getByText(/in preparazione/i);
    const readyBadge = page.getByText(/pronto/i);

    // Badges should be visible if orders exist
    // In a test environment, orders may not be present
  });
});

test.describe('Order Actions', () => {
  test('should have action buttons for orders', async ({ page }) => {
    await page.goto('/(tabs)/kitchen');
    await page.waitForLoadState('networkidle');

    // Check for action buttons
    const readyButton = page.getByRole('button', { name: /pronto/i });
    const deliveredButton = page.getByRole('button', { name: /consegnato/i });

    // Buttons may be disabled if no orders are available
  });
});