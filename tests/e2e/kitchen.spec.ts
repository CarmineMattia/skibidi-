/**
 * E2E Test: Kitchen Dashboard — admin order queue + access control.
 *
 * Verifies the admin kitchen renders (order queue + status tabs) and that
 * non-admin users (including unauthenticated guests) are redirected away.
 */

import { test, expect, type Page } from '@playwright/test';
import { mockEmptyBackend } from './fixtures/mockBackend';
import { mockLoggedInAdmin } from './fixtures/mockSession';

// Sessione admin mockata (login solo Google): nessun login reale, backend intercettato.
async function asAdmin(page: Page) {
  await mockEmptyBackend(page);
  await mockLoggedInAdmin(page);
}

test.describe('Kitchen Dashboard', () => {
  test('1. Kitchen shows the active orders queue', async ({ page }) => {
    await asAdmin(page);
    await page.goto('/(tabs)/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByText('Cucina').first()).toBeVisible();
    await expect(page.getByText('ORDINI ATTIVI').first()).toBeVisible();
  });

  test('2. Kitchen shows status tabs', async ({ page }) => {
    await asAdmin(page);
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
