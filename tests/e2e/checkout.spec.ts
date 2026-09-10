/**
 * E2E Test: Checkout Flow — a guest adds items, opens the checkout, and
 * advances through the order-type and time-selection steps.
 *
 * The checkout lives at /modal (a multi-step modal). A drink must be in the
 * cart (or the drinks category active) to bypass the "add a drink" hint that
 * otherwise prevents navigation.
 */

import { test, expect, type Page } from '@playwright/test';
import { enterGuestMode } from '../fixtures/page-objects';

/** Add a pizza and a drink so the cart is non-empty and has a drink. */
async function addPizzaAndDrink(page: Page) {
  const addButtons = page.getByRole('button', { name: /Aggiungi .*al carrello/i });
  await addButtons.first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await addButtons.nth(0).click(); // a pizza
  await page.getByText('Bevande').first().click(); // switch to the drinks category
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Aggiungi .*al carrello/i }).first().click(); // a drink
  await page.waitForTimeout(600);
}

/** Tap the cart's "Procedi al Pagamento" and wait for the checkout modal. */
async function openCheckout(page: Page) {
  await page.getByText('Procedi al Pagamento').first().click();
  await expect(page).toHaveURL(/\/modal/, { timeout: 8000 });
}

test.describe('Checkout Flow', () => {
  test('1. Guest can open the checkout from the cart', async ({ page }) => {
    await enterGuestMode(page);
    await addPizzaAndDrink(page);
    await openCheckout(page);
    await expect(page.getByText('Come vuoi ordinare?').first()).toBeVisible();
  });

  test('2. Checkout shows the order-type options', async ({ page }) => {
    await enterGuestMode(page);
    await addPizzaAndDrink(page);
    await openCheckout(page);
    await expect(page.getByText('Mangio qui').first()).toBeVisible();
    await expect(page.getByText('Da asporto').first()).toBeVisible();
    await expect(page.getByText('Delivery').first()).toBeVisible();
  });

  test('3. Guest can select take-away and advance to time selection', async ({ page }) => {
    await enterGuestMode(page);
    await addPizzaAndDrink(page);
    await openCheckout(page);
    await page.getByText('Da asporto').first().click();
    await page.getByText('Continua', { exact: true }).first().click();
    await expect(page.getByText('Il prima possibile').first()).toBeVisible({ timeout: 8000 });
  });

  test('4. Empty cart does not show the checkout button', async ({ page }) => {
    await enterGuestMode(page);
    const addButtons = page.getByRole('button', { name: /Aggiungi .*al carrello/i });
    await addButtons.first().waitFor({ timeout: 15000 });
    // With an empty cart the CartSummary shows its empty state, not the button.
    await expect(page.getByText('Procedi al Pagamento')).toHaveCount(0);
  });
});
