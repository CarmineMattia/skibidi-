// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-server-receipt-status-pglite.mjs
// (oppure, con la PR CI: npm run test:sql -- server-receipt-status)
// Catena ordini + #28/#30/#32/#33/#34 + fixture con lo stato live (policy/trigger/grant), poi:
// 0) repro PRIMA della migration: il cliente segna il proprio scontrino come 'success';
// 1) 20261023100000_server_side_receipt_status.sql (due volte: idempotente) + tests/sql/server-receipt-status.sql;
// 2) le suite esistenti con la migration applicata.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261023100000_server_side_receipt_status.sql';
const lock = 'supabase/migrations/20261020160000_customer_order_update_lock.sql';
const m33 = 'supabase/migrations/20261020150000_server_side_pricing.sql';
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
  m33,
  'tests/sql/customer-order-lock-schema.sql',
  lock,
  'tests/sql/server-receipt-status-schema.sql',
];
async function run(db, files, quiet = false) {
  for (const f of files) {
    const sql = fs.readFileSync(path.join(root, f), 'utf8').replace(/^\\set.*$/gm, '');
    try {
      const res = await db.exec(sql);
      const last = res.at(-1)?.rows?.[0];
      if (!quiet) console.log('OK', f, last ? JSON.stringify(last) : '');
    } catch (e) {
      console.log('FAIL', f, e.message, e.detail ?? '', e.where ?? '');
      process.exit(1);
    }
  }
}
async function loadCatalogue(db) {
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/ambrosia-catalogue.json'), 'utf8'));
  const { builder_product: builder } = JSON.parse(fs.readFileSync(path.join(root, 'tests/sql/fixtures/pricing-cases.json'), 'utf8'));
  const company = catalogue.company_id;
  for (const c of catalogue.categories) {
    await db.query('INSERT INTO categories (id, name, active, company_id) VALUES ($1, $2, $3, $4)', [c.id, c.name, c.active ?? true, company]);
  }
  for (const p of [...catalogue.products, builder]) {
    await db.query('INSERT INTO products (id, company_id, active, price, name, category_id, ingredients) VALUES ($1, $2, true, $3, $4, $5, $6)',
      [p.id, company, p.price, p.name, p.category_id, p.ingredients ?? null]);
  }
}

// 0) repro: before the migration the customer CAN mark their own receipt as success.
{
  const db = new PGlite();
  await run(db, chain, true);
  await db.exec(`SELECT pg_temp.seed();
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
    SET test.staff = 'false';
    UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-FAKE' WHERE id = '00000000-0000-0000-0000-000000000101';
    RESET ROLE;`);
  const { rows } = await db.query(`SELECT fiscal_status FROM orders WHERE id = '00000000-0000-0000-0000-000000000101'`);
  if (rows[0]?.fiscal_status !== 'success') { console.log('FAIL repro: expected the old rules to allow it', rows); process.exit(1); }
  console.log('OK repro before migration: customer set own receipt to success (the hole)');
}

const base = [...chain, migration, migration];
await run(new PGlite(), [...base, 'tests/sql/server-receipt-status.sql']);
for (const suite of [
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ['tests/sql/security-definer-grants.sql'],
  ['tests/sql/db-hardening.sql'],
  ['tests/sql/order-items-insert-guard.sql'],
]) await run(new PGlite(), [...base, ...suite]);
{
  const db = new PGlite();
  await run(db, base, true);
  await loadCatalogue(db);
  await run(db, ['tests/sql/server-pricing.sql']);
}
console.log('ALL PASS');
