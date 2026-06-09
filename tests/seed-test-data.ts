/**
 * Test Data Seeder  v3
 *
 * Seeds the Supabase database with test products, categories, and user profiles
 * so E2E tests have a clean, predictable state.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env to bypass RLS + auth rate limits.
 * Falls back gracefully if the key is unavailable.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxxx npx tsx tests/seed-test-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
dotenv.config({ path: resolve(ROOT, '.env') });

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zqubwvhstobaugifzoyb.supabase.co';
const ANON_KEY         = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const COMPANY_ID       = process.env.EXPO_PUBLIC_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

const hasServiceKey = SERVICE_KEY.length > 50;

// ── Seed Data ──────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Pizze Classiche', description: 'Le nostre pizze tradizionali', order: 1 },
  { name: 'Pizze Speciali',  description: 'Pizze con ingredienti speciali', order: 2 },
  { name: 'Fritti',          description: 'Antipasti fritti', order: 3 },
  { name: 'Bevande',         description: 'Bevande fresche', order: 4 },
  { name: 'Dolci',           description: 'Dolci freschi ogni giorno', order: 5 },
];

const PRODUCTS: Array<{ name: string; desc: string; price: number; cat: string; order: number }> = [
  { name: 'Margherita',   desc: 'Pomodoro, mozzarella, basilico',          price: 8.50,  cat: 'Pizze Classiche', order: 1 },
  { name: 'Marinara',     desc: 'Pomodoro, aglio, origano',                price: 7.50,  cat: 'Pizze Classiche', order: 2 },
  { name: 'Capricciosa',  desc: 'Pomodoro, mozzarella, funghi, carciofi',  price: 11.00, cat: 'Pizze Speciali',  order: 1 },
  { name: 'Diavola',      desc: 'Pomodoro, mozzarella, salame piccante',   price: 10.50, cat: 'Pizze Speciali',  order: 2 },
  { name: 'Patatine',     desc: 'Patate fritte croccanti',                 price: 4.50,  cat: 'Fritti',          order: 1 },
  { name: 'Coca Cola',    desc: 'Lattina 33cl',                            price: 3.00,  cat: 'Bevande',         order: 1 },
  { name: 'Acqua Nat.',   desc: 'Acqua minerale 50cl',                     price: 1.50,  cat: 'Bevande',         order: 2 },
  { name: 'Tiramisù',     desc: 'Dolce classico al caffè',                 price: 6.00,  cat: 'Dolci',           order: 1 },
];

const TEST_USERS = [
  { role: 'admin' as const,    email: 'admin-e2e@skibidi-test.com',    password: 'TestAdmin123!',    name: 'Admin E2E' },
  { role: 'kiosk' as const,    email: 'kiosk-e2e@skibidi-test.com',    password: 'TestKiosk123!',    name: 'Kiosk E2E' },
  { role: 'customer' as const, email: 'customer-e2e@skibidi-test.com', password: 'TestCustomer123!', name: 'Customer E2E' },
];

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function authClient(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth: ${error.message}`);
  return c;
}

// ── Main ───────────────────────────────────────────────────────────

async function seed() {
  console.log('🚀 Seeding test data...\n');

  if (!hasServiceKey) {
    console.log('⚠️  No SUPABASE_SERVICE_ROLE_KEY set.');
    console.log('   Set it in .env or pass as env var to enable user creation & RLS bypass.');
    console.log('   Continuing with read-only checks...\n');
  }

  // Use service_role client for RLS bypass, or anon for reads
  const admin = hasServiceKey
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
  const anon  = createClient(SUPABASE_URL, ANON_KEY);

  // Which client to use for writes
  const db = admin ?? anon;

  // ── Step 1: Users (requires service role key) ─────────────────────
  const userIds: Record<string, string> = {};

  if (admin) {
    console.log('📦 Creating/ensuring test users...');
    for (const u of TEST_USERS) {
      // Try sign-in first
      const { data: si } = await anon.auth.signInWithPassword({ email: u.email, password: u.password });
      if (si?.user) {
        userIds[u.role] = si.user.id;
        console.log(`  ✅ ${u.role} exists: ${u.email}`);
        continue;
      }

      // Create via admin API (no rate limit)
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.name, role: u.role },
      });
      if (ce) { console.error(`  ❌ ${u.role}: ${ce.message}`); continue; }
      if (created?.user) {
        userIds[u.role] = created.user.id;
        console.log(`  ✅ ${u.role} created: ${u.email}`);
      }
    }

    // Create profiles
    console.log('\n📦 Profiles...');
    for (const u of TEST_USERS) {
      const uid = userIds[u.role];
      if (!uid) continue;
      await db.from('profiles').upsert(
        { id: uid, email: u.email, full_name: u.name, role: u.role },
        { onConflict: 'id' }
      ).then(({ error: e }) => {
        if (e) console.error(`  ❌ ${u.role}: ${e.message}`);
        else console.log(`  ✅ ${u.role} profile OK`);
      });
    }

    // Write .env.test
    const envTest = [
      `# Generated by tests/seed-test-data.ts`,
      `TEST_ADMIN_EMAIL=${TEST_USERS[0].email}`,
      `TEST_ADMIN_PASSWORD=${TEST_USERS[0].password}`,
      `TEST_KIOSK_EMAIL=${TEST_USERS[1].email}`,
      `TEST_KIOSK_PASSWORD=${TEST_USERS[1].password}`,
      `TEST_CUSTOMER_EMAIL=${TEST_USERS[2].email}`,
      `TEST_CUSTOMER_PASSWORD=${TEST_USERS[2].password}`,
      `COMPANY_ID=${COMPANY_ID}`,
      ``,
    ].join('\n');
    fs.writeFileSync(resolve(ROOT, '.env.test'), envTest);
    console.log('📝 .env.test written');
  } else {
    // Without service key — just note that users must be pre-existing
    console.log('📦 Test users — skipping (need SERVICE_ROLE_KEY)');
    // Try to sign in with known creds
    for (const u of TEST_USERS) {
      const { data: si } = await anon.auth.signInWithPassword({ email: u.email, password: u.password });
      if (si?.user) {
        userIds[u.role] = si.user.id;
        console.log(`  ✅ ${u.role} existing: ${u.email}`);
      } else {
        console.log(`  ⚠️  ${u.role} not available (run with SERVICE_ROLE_KEY to create)`);
      }
    }

    // Try to load existing .env.test
    try {
      const prev = fs.readFileSync(resolve(ROOT, '.env.test'), 'utf-8');
      console.log('📝 Using existing .env.test credentials');
    } catch { /* no existing */ }
  }

  // ── Step 2: Categories ────────────────────────────────────────────
  console.log('\n📦 Categories...');
  const catIds: Record<string, string> = {};

  const { data: existingCats } = await db.from('categories').select('id,name');
  const catMap: Record<string, string[]> = {};
  for (const c of existingCats ?? []) {
    if (!catMap[c.name]) catMap[c.name] = [];
    catMap[c.name].push(c.id);
  }

  for (const c of CATEGORIES) {
    if (catMap[c.name]?.length > 0) {
      catIds[c.name] = catMap[c.name][0];
      console.log(`  ✅ "${c.name}"`);
      continue;
    }
    const { data: ins, error: e } = await db.from('categories').insert({
      name: c.name, description: c.description, display_order: c.order,
      active: true, company_id: COMPANY_ID,
    }).select('id').single();
    if (e) console.error(`  ❌ "${c.name}": ${e.message}`);
    else { catIds[c.name] = ins.id; console.log(`  ✅ "${c.name}" created`); }
  }

  // ── Step 3: Products ──────────────────────────────────────────────
  console.log('\n📦 Products...');

  // If we have an authenticated session, use it for product inserts
  let writeClient = db;
  if (!admin) {
    // Try to get an authenticated session from any existing user
    for (const u of TEST_USERS) {
      try {
        writeClient = await authClient(u.email, u.password);
        console.log(`  🔐 Using ${u.role} session for product writes`);
        break;
      } catch { /* try next */ }
    }
  }

  for (const p of PRODUCTS) {
    const cid = catIds[p.cat];
    if (!cid) { console.warn(`  ⚠️  No category "${p.cat}"`); continue; }

    const { data: ex } = await writeClient.from('products').select('id').eq('name', p.name).eq('category_id', cid).limit(1);
    if (ex?.length) { console.log(`  ✅ "${p.name}"`); continue; }

    const { error: e } = await writeClient.from('products').insert({
      category_id: cid, name: p.name, description: p.desc,
      price: p.price, active: true, display_order: p.order, company_id: COMPANY_ID,
    });
    if (e) console.error(`  ❌ "${p.name}": ${e.message}`);
    else console.log(`  ✅ "${p.name}" €${p.price.toFixed(2)}`);
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(hasServiceKey ? '✅ Seeding complete!' : '⚠️  Seeding partial (no SERVICE_ROLE_KEY)');
  console.log('══════════════════════════════════════════════════');
  if (hasServiceKey) {
    for (const u of TEST_USERS) {
      console.log(`  ${userIds[u.role] ? '✅' : '❌'} ${u.role.padEnd(10)} ${u.email}`);
    }
  }
  console.log(`  Categories: ${Object.keys(catIds).length}/${CATEGORIES.length}`);
  console.log('');
}

seed().catch((err) => { console.error('❌', err); process.exit(1); });