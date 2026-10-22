// Runner PGlite (nessun DB ospitato) per 20261022100000_order_notes_menu_hardening.sql.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-order-notes-hardening-pglite.mjs
// A) catena ordini (come run-server-pricing-pglite.mjs) + #33 + #34 + migration (due volte: idempotente):
//    note pulite e limitate, reserve_order_display_code solo lato server, poi le suite esistenti
//    (server-pricing.sql, customer-order-lock.sql) e gli ordini del catalogo reale con le note canoniche invariate.
// B) fixture menu (#35) + migration: anon vede solo prodotti/categorie attivi di aziende attive,
//    chi è loggato vede come prima.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runNotesCases } from './order-notes-hardening.mjs';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261022100000_order_notes_menu_hardening.sql';
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
  'supabase/migrations/20261020150000_server_side_pricing.sql',
];
async function run(db, files, quiet = false) {
  for (const f of files) {
    const sql = fs.readFileSync(path.join(root, f), 'utf8').replace(/^\\set.*$/gm, '');
    try {
      const res = await db.exec(sql);
      const last = res.at(-1)?.rows?.[0];
      if (!quiet) console.log('OK', f, last ? JSON.stringify(last) : '');
    } catch (e) {
      console.log('FAIL', f, e.message, e.detail ?? '', e.hint ?? '', e.where ?? '');
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
const fail = (msg) => { console.log('FAIL', msg); process.exit(1); };

console.log('== A) note ordine + reserve_order_display_code (catena ordini)');
{
  const db = new PGlite();
  await run(db, [...chain, migration, migration], true);
  console.log('OK catena + migration applicata due volte');
  await loadCatalogue(db);
  const margherita = catalogue.products.find((p) => p.name === 'Margherita');
  if (!margherita) fail('Margherita non nel catalogo');
  try {
    // mezzo metro con 3 gusti (come i casi di prezzo) e 12 ingredienti aggiunti del listino
    const metroCase = cases.find((c) => /\nTaglia: Mezzo metro\n/.test(c.notes ?? '') && /\nGusto 3: /.test(c.notes));
    if (!metroCase) fail('nessun caso mezzo metro a 3 gusti nei casi di prezzo');
    const gusti = [1, 2, 3].map((k) => metroCase.notes.match(new RegExp(`\\nGusto ${k}: ([^+\\n][^\\n]*)`))[1])
      .map((g) => g.replace(/^(No|Extra) .*/, ''));
    const extras = (await db.query(`SELECT i->>'name' AS name FROM jsonb_array_elements(public.menu_pricing_default()->'ingredients') i`)).rows.map((r) => r.name);
    const metroProduct = catalogue.products.find((p) => p.id === metroCase.product_id);
    await runNotesCases(db, { company, product: margherita.id, productName: margherita.name,
      metro: { id: metroCase.product_id, name: metroProduct.name, gusti, extras } });
  } catch (e) {
    fail(e.message);
  }
}
{
  // le suite esistenti con la migration applicata
  const db = new PGlite();
  await run(db, [...chain, migration], true);
  await loadCatalogue(db);
  await run(db, ['tests/sql/server-pricing.sql']);
}
{
  const db = new PGlite();
  await run(db, [...chain, 'tests/sql/customer-order-lock-schema.sql', 'supabase/migrations/20261020160000_customer_order_update_lock.sql', migration], true);
  await run(db, ['tests/sql/customer-order-lock.sql']);
}
{
  // ordini reali dai casi di prezzo: le note canoniche salvate non cambiano con il trigger
  const db = new PGlite();
  await run(db, [...chain, migration], true);
  await loadCatalogue(db);
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
    const items = chunk.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: 0.01, total_price: 0.01 * c.quantity, notes: c.notes }));
    const r = (await db.query('SELECT public.create_order_with_items($1::jsonb, $2::jsonb) AS r',
      [JSON.stringify({ id, company_id: company, customer_id: '00000000-0000-0000-0000-0000000000c1', total_amount: 0.01, order_type: 'take_away' }), JSON.stringify(items)])).rows[0].r;
    r.items.forEach((it, k) => {
      if (Math.abs(Number(it.unit_price) - chunk[k].unit_price) > 0.001 || it.notes !== chunk[k].notes) fail(`riga ${chunk[k].label} ${it.unit_price} ${it.notes}`);
    });
  }
  console.log(`OK ${n} ordini del catalogo reale: prezzi e note canoniche invariati con il trigger`);
}

console.log('== B) menu senza login (fixture #35)');
const stubs = `
  -- tabelle/funzione toccate dalla migration ma assenti dalla fixture menu (solo forma)
  CREATE TABLE IF NOT EXISTS public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notes text);
  CREATE TABLE IF NOT EXISTS public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, notes text);
  CREATE OR REPLACE FUNCTION public.reserve_order_display_code(p_company_id uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 'X #1' $$;`;
{
  const db = new PGlite();
  await run(db, ['tests/sql/customer-company-menu-schema.sql', 'supabase/migrations/20261020170000_customer_company_menu.sql'], true);
  await db.exec(stubs);
  await run(db, [migration, migration, 'tests/sql/menu-anon-active.sql']);
}
{
  // prima della migration anon vedeva tutto (stato di prod oggi): il test sopra lo cambia davvero
  const db = new PGlite();
  await run(db, ['tests/sql/customer-company-menu-schema.sql', 'supabase/migrations/20261020170000_customer_company_menu.sql'], true);
  await db.exec(`BEGIN; SELECT public.t_as('anon', NULL);`);
  const n = (await db.query('SELECT count(*)::int AS n FROM public.products')).rows[0].n;
  await db.exec('ROLLBACK');
  if (n !== 4) fail(`prima della migration anon vedeva ${n} prodotti (attesi 4)`);
  console.log('OK prima della migration anon vede 4 prodotti (anche inattivi e di aziende chiuse); dopo: 2');
}
console.log('ALL PASS');
