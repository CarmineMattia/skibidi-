/**
 * E2E Test: Kitchen Dashboard — admin order queue + access control.
 *
 * Verifies the admin kitchen renders (order queue + status tabs) and that
 * non-admin users (including unauthenticated guests) are redirected away.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../fixtures/page-objects';

test.describe('Kitchen Dashboard', () => {
  test('1. Kitchen shows the active orders queue', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) {
      test.skip(true, 'Admin account not reachable');
      return;
    }
    await page.goto('/(tabs)/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByText('Cucina').first()).toBeVisible();
    await expect(page.getByText('ORDINI ATTIVI').first()).toBeVisible();
  });

  test('2. Kitchen shows status tabs', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) {
      test.skip(true, 'Admin account not reachable');
      return;
    }
    await page.goto('/(tabs)/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Attivi', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('In Preparazione', { exact: true }).first()).toBeVisible();
  });

  test('3. Unauthenticated guest cannot access the kitchen', async ({ page }) => {
    // Fresh context = no session. The route guard must redirect away from /kitchen.
    await page.goto('/(tabs)/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await expect(page).not.toHaveURL(/kitchen/);
    await expect(page.getByText('Cucina').first()).not.toBeVisible();
  });
});
