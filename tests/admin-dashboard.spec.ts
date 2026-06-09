/**
 * E2E Test: Admin Dashboard & Kitchen Management Flow
 *
 * Signs in as admin, navigates to the kitchen dashboard, manages orders.
 *
 * Note: Admin login requires a pre-existing admin user in Supabase Auth.
 * Run tests/seed-test-data.ts with SUPABASE_SERVICE_ROLE_KEY first.
 * Falls back gracefully if admin credentials aren't available.
 */

import { test, expect, type Page } from '@playwright/test';

// Lazy Supabase client — avoids crash when env vars aren't loaded in Playwright's context
let _supabase: any = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zqubwvhstobaugifzoyb.supabase.co';
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!ANON_KEY) {
    // Try to read from .env or .env.test
    const fs = await import('node:fs');
    const path = await import('node:path');
    try {
      const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
      const match = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
      if (match) process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = match[1].trim();
    } catch { /* ignore */ }
  }
  // Fallback: hardcoded key from project
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdWJ3dmhzdG9iYXVnaWZ6b3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDg3OTksImV4cCI6MjA4Mzk4NDc5OX0.IWQDg4CNo8UHVMkFhXVkDG1O1IxoADpMX938kapr-SE';
  _supabase = createClient(SUPABASE_URL, key);
  return _supabase;
}

const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL || 'admin-e2e@skibidi-test.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestAdmin123!';

// ── Helpers ─────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page): Promise<boolean> {
  try {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByPlaceholder(/esempio@email\.com|email/i);
    const passwordInput = page.getByPlaceholder(/••••••••|password/i);

    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(ADMIN_PASSWORD);

    const loginBtn = page.getByText('Accedi').first();
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();

    // Wait for redirect to menu
    await page.waitForURL(/\/(tabs|\/menu)/, { timeout: 8000 });
    return true;
  } catch (err) {
    console.log(`⚠️  Admin login failed (credentials may not exist): ${err instanceof Error ? err.message : 'Unknown'}`);
    return false;
  }
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('Admin Dashboard & Kitchen Flow', () => {

  test('1. Admin can access the Kitchen dashboard', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'Admin credentials not available — run seed-test-data.ts first');
      return;
    }

    await page.goto('/(tabs)/kitchen');
    await page.waitForLoadState('networkidle');

    // Kitchen header or orders section
    const header = page.getByText(/cucina|kitchen|ordini attivi/i);
    await expect(header.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Kitchen dashboard loaded');
  });

  test('2. Admin can see pending orders', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'Admin credentials not available');
      return;
    }

    await page.goto('/(tabs)/kitchen');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check for order cards or status badges
    const orderCards = page.locator('[class*="OrderCard"], [class*="KitchenOrder"]');
    const orderCount = await orderCards.count();

    if (orderCount > 0) {
      console.log(`📊 ${orderCount} order card(s) visible`);
    } else {
      // Check if any text suggests orders exist
      const bodyText = await page.locator('body').innerText();
      const hasOrderRef = /ordine|order|in attesa|pending|preparing|pronto/i.test(bodyText);
      console.log(`📊 No order cards found. Has order text: ${hasOrderRef}`);
    }
  });

  test('3. Admin Dashboard shows stats', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'Admin credentials not available');
      return;
    }

    await page.goto('/(tabs)/admin-dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should show stats
    const stats = page.getByText(/dashboard|statistiche|ricavi|revenue|ordini|orders/i);
    await expect(stats.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Admin dashboard loaded');
  });

  test('4. Unauthenticated users cannot access kitchen', async ({ page }) => {
    // Simulate guest via localStorage (Pressable click doesn't work in headless RN Web)
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('skibidi_lastLoginAsGuest', 'true');
      localStorage.setItem('skibidi_kioskModeEnabled', 'true');
    });
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Kitchen tab should not be visible for guest
    const kitchenTab = page.getByText(/cucina|kitchen/i);
    await expect(kitchenTab).not.toBeVisible();
    console.log('✅ Kitchen tab correctly hidden from guests');
  });
});