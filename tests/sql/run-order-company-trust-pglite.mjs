// PGlite only. Proves create_order_with_items takes the company from the
// caller profile and still stores order_line_priced, not the client price.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const chain = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901000000_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
  'supabase/migrations/20261013000200_order_manual_approval_guard.sql',
  'supabase/migrations/20261013140000_order_antiabuse.sql',
  'tests/sql/db-hardening-schema.sql',
  'tests/sql/security-definer-grants-schema.sql',
  'tests/sql/order-items-insert-guard-schema.sql',
  'supabase/migrations/20260904_order_display_code_sequential.sql',
  'supabase/migrations/20261012234356_enable_rls_order_daily_counters.sql',
  'supabase/migrations/20261020120000_security_definer_grants.sql',
  'supabase/migrations/20261020130000_db_hardening_truncate_defaults.sql',
  'supabase/migrations/20261020140000_order_items_insert_guard.sql',
  'tests/sql/server-pricing-schema.sql',
  'supabase/migrations/20261020150000_server_side_pricing.sql',
  'supabase/migrations/20261022100000_order_notes_menu_hardening.sql',
  'supabase/migrations/20261022100000_order_notes_menu_hardening.sql',
  'supabase/migrations/20261112010000_order_item_price_and_company.sql',
  'supabase/migrations/20261112010000_order_item_price_and_company.sql',
];

const db = new PGlite();
for (const file of chain) {
  const sql = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\\set.*$/gm, '');
  try {
    await db.exec(sql);
    console.log('OK', file);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log('FAIL', file, err.message);
    process.exit(1);
  }
}

const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/ambrosia-catalogue.json'), 'utf8'));
const { builder_product: builder, cases } = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/sql/fixtures/pricing-cases.json'), 'utf8')
);
const company = catalogue.company_id;
const products = [...catalogue.products, builder];
for (const c of catalogue.categories) {
  await db.query('INSERT INTO categories (id, name, active, company_id) VALUES ($1, $2, $3, $4)', [
    c.id, c.name, c.active ?? true, company,
  ]);
}
for (const p of products) {
  await db.query(
    'INSERT INTO products (id, company_id, active, price, name, category_id, ingredients) VALUES ($1, $2, true, $3, $4, $5, $6)',
    [p.id, company, p.price, p.name, p.category_id, p.ingredients ?? null]
  );
}
const byId = new Map(products.map((p) => [p.id, p]));
const special = cases.find((c) => {
  const product = byId.get(c.product_id);
  return product && Math.abs(c.unit_price - product.price) > 0.001;
});
if (!special) {
  console.log('FAIL no priced line differs from the base product price');
  process.exit(1);
}
const base = byId.get(special.product_id).price;
await db.query(`SELECT set_config('test.priced_product', $1, false)`, [special.product_id]);
await db.query(`SELECT set_config('test.line_notes', $1, false)`, [special.notes ?? '']);
await db.query(`SELECT set_config('test.priced_unit', $1, false)`, [String(special.unit_price)]);
await db.query(`SELECT set_config('test.base_price', $1, false)`, [String(base)]);

const sql = fs.readFileSync(path.join(root, 'tests/sql/order-company-trust.sql'), 'utf8');
try {
  await db.exec(sql);
  console.log('OK tests/sql/order-company-trust.sql');
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.log('FAIL tests/sql/order-company-trust.sql', err.message);
  process.exit(1);
}
console.log('ALL PASS');
