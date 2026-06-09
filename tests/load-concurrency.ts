/**
 * Load & Concurrency Test
 *
 * Tests database throughput for rapid order insertions.
 * Attempts to place orders directly to Supabase and measures success rate.
 *
 * Usage:
 *   npx tsx tests/load-concurrency.ts
 *
 * For full RLS bypass, provide SUPABASE_SERVICE_ROLE_KEY.
 * Without it, the test will still run but many inserts will fail (RLS).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '..', '.env') });
dotenv.config({ path: resolve(import.meta.dirname, '..', '.env.test') });

// ── Config ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zqubwvhstobaugifzoyb.supabase.co';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const COMPANY_ID = process.env.EXPO_PUBLIC_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

const CONCURRENT_ORDERS = 20;
const TIME_WINDOW_MS = 5000;

// ── Results ─────────────────────────────────────────────────────────

interface OrderResult {
  index: number;
  orderId: string | null;
  success: boolean;
  error?: string;
  elapsedMs: number;
}

// ── Main ────────────────────────────────────────────────────────────

async function runLoadTest() {
  console.log('══════════════════════════════════════════════');
  console.log('🏋️  LOAD & CONCURRENCY TEST');
  console.log(`📊 ${CONCURRENT_ORDERS} concurrent placements in ${TIME_WINDOW_MS}ms`);
  console.log('══════════════════════════════════════════════\n');

  // ── Step 1: Get a client with write access ─────────────────────────
  let client: SupabaseClient;
  let clientDesc: string;

  if (SERVICE_KEY.length > 50) {
    client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    clientDesc = 'service_role';
  } else {
    // Try to sign in with test credentials
    const testEmail = process.env.TEST_KIOSK_EMAIL ?? 'kiosk-e2e@skibidi-test.com';
    const testPass = process.env.TEST_KIOSK_PASSWORD ?? 'TestKiosk123!';
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data: auth } = await anon.auth.signInWithPassword({ email: testEmail, password: testPass });
    if (auth?.user) {
      client = anon;
      clientDesc = `authenticated (${testEmail})`;
    } else {
      client = createClient(SUPABASE_URL, ANON_KEY);
      clientDesc = 'anonymous (RLS will block inserts)';
    }
  }

  console.log(`🔑 Client mode: ${clientDesc}\n`);

  // ── Step 2: Get a test product ─────────────────────────────────────
  const { data: products } = await client
    .from('products')
    .select('id, price, name')
    .eq('active', true)
    .limit(1);

  if (!products || products.length === 0) {
    console.error('❌ No active products found. Aborting.');
    process.exit(1);
  }

  const testProduct = products[0];
  console.log(`📦 Product: "${testProduct.name}" €${testProduct.price}`);

  // ── Step 3: Fire concurrent orders ─────────────────────────────────
  console.log(`\n🚀 Starting ${CONCURRENT_ORDERS} concurrent placements...\n`);

  const startTime = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENT_ORDERS }, async (_, i) => {
      // Stagger within time window
      const delay = Math.floor(Math.random() * TIME_WINDOW_MS);
      await new Promise((r) => setTimeout(r, delay));

      const orderStart = Date.now();
      const orderId = crypto.randomUUID();

      try {
        const { error: orderErr } = await client.from('orders').insert({
          id: orderId,
          status: 'pending',
          total_amount: testProduct.price,
          fiscal_status: 'pending',
          order_type: 'eat_in',
          customer_name: `Load Test ${i}`,
          table_number: String((i % 20) + 1),
          company_id: COMPANY_ID,
        });

        if (orderErr) {
          return { index: i, orderId: null, success: false, error: orderErr.message, elapsedMs: Date.now() - orderStart };
        }

        const { error: itemErr } = await client.from('order_items').insert({
          order_id: orderId,
          product_id: testProduct.id,
          quantity: (i % 3) + 1,
          unit_price: testProduct.price,
          total_price: testProduct.price * ((i % 3) + 1),
        });

        if (itemErr) {
          return { index: i, orderId, success: false, error: `Item: ${itemErr.message}`, elapsedMs: Date.now() - orderStart };
        }

        return { index: i, orderId, success: true, elapsedMs: Date.now() - orderStart };
      } catch (err: any) {
        return { index: i, orderId: null, success: false, error: err.message ?? String(err), elapsedMs: Date.now() - orderStart };
      }
    })
  );

  const totalTimeMs = Date.now() - startTime;
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const avgLatency = succeeded.length > 0
    ? Math.round(succeeded.reduce((s, r) => s + r.elapsedMs, 0) / succeeded.length)
    : 0;

  console.log('══════════════════════════════════════════════');
  console.log('📊 RESULTS');
  console.log('══════════════════════════════════════════════');
  console.log(`  Attempts:      ${results.length}`);
  console.log(`  Succeeded:     ${succeeded.length}`);
  console.log(`  Failed:        ${failed.length}`);
  console.log(`  Total time:    ${totalTimeMs}ms`);
  console.log(`  Avg latency:   ${avgLatency}ms`);
  console.log(`  Throughput:    ${(results.length / (totalTimeMs / 1000)).toFixed(1)} ops/s`);

  if (failed.length > 0) {
    console.log('\n  ❌ FAILURES:');
    for (const f of failed.slice(0, 5)) {
      console.log(`    #${f.index}: ${f.error}`);
    }
    if (failed.length > 5) console.log(`    ... and ${failed.length - 5} more`);
  }

  // ── Verify (only for successful orders) ──────────────────────────
  if (succeeded.length > 0) {
    const ids = succeeded.map((r) => r.orderId).filter(Boolean) as string[];
    const { data: found } = await client.from('orders').select('id').in('id', ids);
    const foundSet = new Set(found?.map((o) => o.id) ?? []);
    const missing = ids.filter((id) => !foundSet.has(id));

    if (missing.length > 0) {
      console.log(`\n❌ DATA LOSS: ${missing.length} order(s) not found after insert`);
    } else {
      console.log(`\n✅ All ${foundSet.size} orders verified in database`);
    }
  }

  // ── Pass/fail ──────────────────────────────────────────────────
  const noDataLoss = !succeeded.length || (await (async () => {
    const ids = succeeded.map((r) => r.orderId).filter(Boolean) as string[];
    if (!ids.length) return false;
    const { data: found } = await client.from('orders').select('id').in('id', ids);
    return (found?.length ?? 0) === ids.length;
  })());
  const pass = succeeded.length >= Math.round(CONCURRENT_ORDERS * 0.8) && noDataLoss;
  console.log(`\n${pass ? '✅ LOAD TEST PASSED' : '❌ LOAD TEST FAILED'}`);
  if (!noDataLoss) console.log('   Reason: Inserted orders not found in DB (RLS filter or silent discard)');
  process.exit(pass ? 0 : 1);
}

runLoadTest().catch((err) => {
  console.error('❌ Load test crashed:', err);
  process.exit(1);
});