/**
 * E2E Test: Admin — panel access + dashboard/kitchen render.
 *
 * Verifies an admin can log in and reach the admin options, dashboard, and
 * kitchen. Uses a mocked admin session (tests/e2e/fixtures/mockSession.ts): no real
 * login and no real backend.
 */

import { test, expect, type Page } from '@playwright/test';
import { mockEmptyBackend } from './fixtures/mockBackend';
import { mockLoggedInAdmin } from './fixtures/mockSession';

// Sessione admin mockata (login solo Google): nessun login reale, backend intercettato.
async function asAdmin(page: Page) {
  await mockEmptyBackend(page);
  await mockLoggedInAdmin(page);
}

test.describe('Admin Panel Access', () => {
  test('1. Admin can open the admin options page', async ({ page }) => {
    await asAdmin(page);
    await page.goto('/admin-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Opzioni Admin').first()).toBeVisible();
  });

  test('2. Admin can open the dashboard', async ({ page }) => {
    await asAdmin(page);
    await page.goto('/admin-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Dashboard Admin').first()).toBeVisible();
  });

  test('3. Admin can access the kitchen', async ({ page }) => {
    await asAdmin(page);
    await page.goto('/(tabs)/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Cucina').first()).toBeVisible();
  });
});
