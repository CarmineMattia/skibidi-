// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-server-pricing-pglite.mjs
// Catena ordini + #28/#30/#32 + 20261020150000_server_side_pricing.sql (due volte: idempotente).
// 1) carica il catalogo reale Ambrosia (tests/fixtures/ambrosia-catalogue.json) e controlla che
//    order_line_unit_price dia per ogni caso di tests/sql/fixtures/pricing-cases.json lo stesso
//    prezzo del client (generati da tests/unit/serverPricingParity.spec.ts), poi gli stessi casi
//    come ordini reali via create_order_with_items (prezzi client manomessi a 0.01);
// 2) tests/sql/server-pricing.sql (manomissioni, consegna, rifiuti, retry);
// 3) rilancia le suite esistenti con la migration applicata.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261020150000_server_side_pricing.sql';
const chain = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
  'supabase/migrations/20261013_order_manual_approval_guard.sql',
  'supabase/migrations/20261013140000_order_antiabuse.sql',
  'tests/sql/db-hardening-schema.sql',
  'tests/sql/security-definer-grants-schema.sql',
  'tests/sql/order-items-insert-guard-schema.sql',
  'supabase/migrations/20260904_order_display_code_sequential.sql',
  'supabase/migrations/20261013_enable_rls_order_daily_counters.sql',
  'supabase/migrations/20261020120000_security_definer_grants.sql',
  'supabase/migrations/20261020130000_db_hardening_truncate_defaults.sql',
  'supabase/migrations/20261020140000_order_items_insert_guard.sql',
  'tests/sql/server-pricing-schema.sql',
];
const base = [...chain, migration, migration];
async function run(db, files, quiet = false) {
  for (const f of files) {
    const sql = fs.readFileSync(path.join(root, f), 'utf8').replace(/^\\set.*$/gm, '');
    try {
      const res = await db.exec(sql);
      const last = res.at(-1)?.rows?.[0];
      if (!quiet) console.log('OK', f, last ? JSON.stringify(last) : '');
    } catch (e) {
      console.log('FAIL', f, e.message);
      process.exit(1);
    }
  }
}
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/ambrosia-catalogue.json'), 'utf8'));
const { builder_product: builder, cases } = JSON.parse(fs.readFileSync(path.join(root, 'tests/sql/fixtures/pricing-cases.json'), 'utf8'));
const company = catalogue.company_id;
async function loadCatalogue(db) {
  for (const c of catalogue.categories) {
    await db.query('INSERT INTO categories (id, name, active, company_id) VALUES ($1, $2, $3, $4)', [c.id, c.name, c.active ?? true, company]);
  }
  for (const p of [...catalogue.products, builder]) {
    await db.query('INSERT INTO products (id, company_id, active, price, name, category_id, ingredients) VALUES ($1, $2, true, $3, $4, $5, $6)',
      [p.id, company, p.price, p.name, p.category_id, p.ingredients ?? null]);
  }
}

// 1) parity
{
  const db = new PGlite();
  await run(db, base, true);
  await loadCatalogue(db);
  let bad = 0;
  for (const c of cases) {
    const got = Number((await db.query('SELECT public.order_line_unit_price($1, $2, $3) AS p', [company, c.product_id, c.notes])).rows[0].p);
    if (Math.abs(got - c.unit_price) > 0.001) { bad++; if (bad <= 10) console.log('MISMATCH', c.label, 'server', got, 'client', c.unit_price); }
  }
  if (bad) { console.log(`FAIL parità: ${bad}/${cases.length} casi diversi`); process.exit(1); }
  console.log(`OK parità client/server: ${cases.length} casi (taglie, mezzo metro 1-3 gusti, extra, metro, bevande/dolci, builder)`);
  // same cases as real orders (caller c1), 0.01 client prices, 10 lines per order
  await db.exec(`UPDATE companies SET max_order_total = 100000, max_open_orders_per_user = 100000, order_rate_limit_count = 100000,
    settings = '{"deliveryFeeEur": 2.5}' WHERE id = '${company}';
    INSERT INTO profiles(id) VALUES ('00000000-0000-0000-0000-0000000000c1') ON CONFLICT DO NOTHING;
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
    SELECT set_config('request.jwt.claims', '{"is_anonymous":false}', false);`);
  let n = 0;
  for (let i = 0; i < cases.length; i += 10) {
    const chunk = cases.slice(i, i + 10);
    const id = `00000000-0000-0000-0000-${(0xd0000000 + n++).toString(16).padStart(12, '0')}`;
    const type = n % 2 ? 'delivery' : 'take_away';
    const items = chunk.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: 0.01, total_price: 0.01 * c.quantity, notes: c.notes }));
    const r = (await db.query('SELECT public.create_order_with_items($1::jsonb, $2::jsonb) AS r',
      [JSON.stringify({ id, company_id: company, customer_id: '00000000-0000-0000-0000-0000000000c1', total_amount: 0.01, order_type: type, delivery_address: type === 'delivery' ? 'Via Roma 1' : null }), JSON.stringify(items)])).rows[0].r;
    const expected = Math.round((chunk.reduce((s, c) => s + Math.round(c.unit_price * c.quantity * 100) / 100, 0) + (type === 'delivery' ? 2.5 : 0)) * 100) / 100;
    if (Math.abs(Number(r.total_amount) - expected) > 0.001) { console.log('FAIL ordine', id, 'server', r.total_amount, 'atteso', expected); process.exit(1); }
    r.items.forEach((it, k) => {
      if (Math.abs(Number(it.unit_price) - chunk[k].unit_price) > 0.001) { console.log('FAIL riga', chunk[k].label, it.unit_price); process.exit(1); }
    });
  }
  console.log(`OK ${n} ordini via create_order_with_items con prezzi client 0.01: totali = prezzi client reali (+2.5 consegna)`);
}
// 2) server pricing tests
{
  const db = new PGlite();
  await run(db, base, true);
  await loadCatalogue(db);
  await run(db, ['tests/sql/server-pricing.sql']);
}
// 3) existing suites with the pricing migration applied
for (const suite of [
  ['tests/sql/order-items-insert-guard.sql'],
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ['tests/sql/security-definer-grants.sql'],
  ['tests/sql/db-hardening.sql'],
]) { const db = new PGlite(); await run(db, base, true); await run(db, suite); }
console.log('ALL PASS');
