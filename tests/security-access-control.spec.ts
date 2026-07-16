/**
 * E2E Test: Access control — customers cannot reach admin/kitchen, or escalate via API
 *
 * A React-level route guard only stops UI navigation; it does nothing against a
 * customer who calls the Supabase REST/RPC API directly. These tests cover both
 * surfaces: direct URL navigation while authenticated as a non-admin, and raw
 * supabase-js calls that bypass the app UI entirely (proving RLS/trigger
 * enforcement in the database, not just the React guard).
 *
 * Requires the seeded admin/customer accounts (see supabase/reset-test-passwords.sql).
 * Skips gracefully if credentials aren't available, matching admin-dashboard.spec.ts.
 */

import { test, expect, type Page } from '@playwright/test';

// Lazy Supabase client — avoids crash when env vars aren't loaded in Playwright's context
let _supabase: any = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zqubwvhstobaugifzoyb.supabase.co';
  let key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    try {
      const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
      const match = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
      if (match) key = match[1].trim();
    } catch { /* ignore */ }
  }
  _supabase = createClient(SUPABASE_URL, key || '');
  return _supabase;
}

const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || 'customer@skibidi.com';
const CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'Customer123!';

async function loginAsCustomer(page: Page): Promise<boolean> {
  try {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // let RN Web finish hydrating before clicking

    // Login defaults to passwordless OTP; switch to the email+password form.
    await page.getByText('Accedi con email e password').click({ timeout: 5000 });
    await page.waitForTimeout(500);

    const emailInput = page.getByPlaceholder(/esempio@email\.com|email/i);
    const passwordInput = page.getByPlaceholder(/••••••••|password/i);

    await emailInput.fill(CUSTOMER_EMAIL);
    await passwordInput.fill(CUSTOMER_PASSWORD);

    const loginBtn = page.getByText('Accedi').first();
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();

    await page.waitForURL(/\/(tabs|\/menu)/, { timeout: 8000 });
    return true;
  } catch (err) {
    console.log(`⚠️  Customer login failed (credentials may not exist): ${err instanceof Error ? err.message : 'Unknown'}`);
    return false;
  }
}

test.describe('Access control — customer cannot reach admin/kitchen by direct URL', () => {
  test('1. Logged-in customer navigating directly to /kitchen is redirected away', async ({ page }) => {
    const loggedIn = await loginAsCustomer(page);
    if (!loggedIn) {
      test.skip(true, 'Customer credentials not available — run supabase/reset-test-passwords.sql first');
      return;
    }

    await page.goto('/(tabs)/kitchen');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // The route guard must redirect away — the kitchen order queue never renders.
    await expect(page).not.toHaveURL(/kitchen/);
    await expect(page.getByText(/^Cucina$/i)).not.toBeVisible();
  });

  test('2. Logged-in customer navigating directly to /admin-dashboard is redirected away', async ({ page }) => {
    const loggedIn = await loginAsCustomer(page);
    if (!loggedIn) {
      test.skip(true, 'Customer credentials not available');
      return;
    }

    await page.goto('/(tabs)/admin-dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(/admin-dashboard/);
    await expect(page.getByText(/statistiche|ricavi/i)).not.toBeVisible();
  });

  test('3. Logged-in customer navigating directly to /admin-options is redirected away', async ({ page }) => {
    const loggedIn = await loginAsCustomer(page);
    if (!loggedIn) {
      test.skip(true, 'Customer credentials not available');
      return;
    }

    await page.goto('/admin-options');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(/admin-options/);
  });
});

test.describe('Access control — RLS/trigger enforcement via direct API calls (bypassing the UI)', () => {
  test('4. Customer cannot change their own order status via a direct API call', async () => {
    const supabase = await getSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: CUSTOMER_EMAIL,
      password: CUSTOMER_PASSWORD,
    });
    if (signInError) {
      test.skip(true, `Customer credentials not available: ${signInError.message}`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toBeTruthy();

    const { data: ownOrders } = await supabase
      .from('orders')
      .select('id, status')
      .eq('customer_id', user!.id)
      .limit(1);

    const orderId = ownOrders?.[0]?.id;
    if (!orderId) {
      test.skip(true, 'Test customer has no order to attempt status tampering on');
      await supabase.auth.signOut();
      return;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);

    // prevent_customer_order_tampering trigger must reject this.
    expect(updateError).toBeTruthy();

    await supabase.auth.signOut();
  });

  test('5. Customer cannot self-promote their profile role to admin via a direct API call', async () => {
    const supabase = await getSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: CUSTOMER_EMAIL,
      password: CUSTOMER_PASSWORD,
    });
    if (signInError) {
      test.skip(true, `Customer credentials not available: ${signInError.message}`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toBeTruthy();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user!.id);

    // prevent_profile_privilege_escalation trigger must reject this.
    expect(updateError).toBeTruthy();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();
    expect(profile?.role).not.toBe('admin');

    await supabase.auth.signOut();
  });

  test('6. Anonymous client cannot read the kitchen order queue', async () => {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, delivery_address, status')
      .limit(5);

    // orders_select only allows the owning customer or an admin — anon has neither.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
