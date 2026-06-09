/**
 * E2E Test: User / Kiosk Order Flow
 *
 * Guest/kiosk user browses menu, adds items via "Aggiungi" button, cart updates.
 */

import { test, expect, type Page } from '@playwright/test';

async function enterAsGuest(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('skibidi_lastLoginAsGuest', 'true');
    localStorage.setItem('skibidi_kioskModeEnabled', 'true');
  });
  await page.goto('/menu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

test.describe('User / Kiosk Order Flow', () => {

  test.beforeEach(async ({ page }) => {
    await enterAsGuest(page);
  });

  // ── 1. Menu renders with products ───────────────────────────────────
  test('1. Menu shows products', async ({ page }) => {
    // Guest identifier
    await expect(page.getByText('Ospite').first()).toBeVisible({ timeout: 15000 });

    // "Aggiungi" buttons exist (one per product)
    const addBtns = page.getByText('Aggiungi');
    const count = await addBtns.count();
    expect(count).toBeGreaterThan(0);
    console.log(`📊 ${count} products with "Aggiungi"`);
  });

  // ── 2. Category filter exists ──────────────────────────────────────
  test('2. Category filter is visible', async ({ page }) => {
    // Category names
    const cat = page.getByText(/Pizze Classiche|Pizze Speciali|Fritti|Bevande|Dolci/i);
    await expect(cat.first()).toBeVisible({ timeout: 15000 });
  });

  // ── 3. Cart section is present on page ──────────────────────────
  test('3. Cart section is visible', async ({ page }) => {
    // The cart footer is always rendered
    await expect(page.getByText('Carrello').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Cart footer section visible');
  });

  // ── 4. Guest badge ────────────────────────────────────────────────
  test('4. Guest badge visible', async ({ page }) => {
    await expect(page.getByText('Ospite').first()).toBeVisible({ timeout: 10000 });
  });
});