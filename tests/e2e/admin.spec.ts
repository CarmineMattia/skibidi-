/**
 * E2E Test: Admin — panel access + dashboard/kitchen render.
 *
 * Verifies an admin can log in and reach the admin options, dashboard, and
 * kitchen. Requires a reachable admin account (admin@skibidi.com / Admin123!)
 * created by supabase/seed-test-data.sql; skips gracefully when it is absent.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../fixtures/page-objects';

test.describe('Admin Panel Access', () => {
  test('1. Admin can open the admin options page', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) {
      test.skip(true, 'Admin account not reachable - create it first');
      return;
    }
    await page.goto('/admin-options', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Opzioni Admin').first()).toBeVisible();
  });

  test('2. Admin can open the dashboard', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) {
      test.skip(true, 'Admin account not reachable');
      return;
    }
    await page.goto('/admin-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Dashboard Admin').first()).toBeVisible();
  });

  test('3. Admin can access the kitchen', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) {
      test.skip(true, 'Admin account not reachable');
      return;
    }
    await page.goto('/(tabs)/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Cucina').first()).toBeVisible();
  });
});
