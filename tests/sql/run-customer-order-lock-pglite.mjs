// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-customer-order-lock-pglite.mjs
// Catena ordini + #28/#30/#32 + fixture con lo stato live (policy/trigger/grant del 20/10), poi:
// 0) repro del tester PRIMA della migration (asporto 5 € → consegna dal cliente: deve riuscire);
// 1) 20261020160000_customer_order_update_lock.sql (due volte: idempotente) + tests/sql/customer-order-lock.sql;
// 2) le suite esistenti con il lucchetto applicato.
// Se nel checkout c'è anche #33 (20261020150000_server_side_pricing.sql) viene applicata
// in entrambi gli ordini (prima/dopo il lucchetto) e rigirano i suoi test.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const has = (f) => fs.existsSync(path.join(root, f));
const migration = 'supabase/migrations/20261020160000_customer_order_update_lock.sql';
const m33 = 'supabase/migrations/20261020150000_server_side_pricing.sql';
const with33 = has(m33);
console.log(with33 ? 'Con #33 (server-side pricing): entrambi gli ordini' : 'Senza #33');
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
  ...(with33 ? ['tests/sql/server-pricing-schema.sql'] : []),
];
const fixture = 'tests/sql/customer-order-lock-schema.sql';
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
// #33: server-pricing.sql needs the real Ambrosia catalogue (same loader as run-server-pricing-pglite.mjs)
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
const existing = [
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ['tests/sql/security-definer-grants.sql'],
  ['tests/sql/db-hardening.sql'],
  ['tests/sql/order-items-insert-guard.sql'],
];
const orders = with33
  ? [['33 -> lock', [m33, m33, fixture, migration, migration]], ['lock -> 33', [fixture, migration, migration, m33, m33]]]
  : [['lock', [fixture, migration, migration]]];
// 0) repro before the fix
await run(new PGlite(), [...chain, ...(with33 ? [m33] : []), fixture, 'tests/sql/customer-order-lock-repro.sql']);
for (const [label, tail] of orders) {
  console.log(`== ${label}`);
  const base = [...chain, ...tail];
  await run(new PGlite(), [...base, 'tests/sql/customer-order-lock.sql']);
  for (const suite of existing) await run(new PGlite(), [...base, ...suite]);
  if (with33) {
    const db = new PGlite();
    await run(db, base, true);
    await loadCatalogue(db);
    await run(db, ['tests/sql/server-pricing.sql']);
  }
}
console.log('ALL PASS');
