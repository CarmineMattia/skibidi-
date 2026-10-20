// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-order-items-insert-guard-pglite.mjs
// Catena ordini + 20261020140000_order_items_insert_guard.sql (due volte: idempotente), poi
// tests/sql/order-items-insert-guard.sql e i test esistenti con la guardia applicata.
// Se nel checkout ci sono #28 e/o #30 vengono applicati prima (ordine: ORDER=28,30 o ORDER=30,28)
// e vengono rieseguiti anche i loro test.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const has = (f) => fs.existsSync(path.join(root, f));
const migration = 'supabase/migrations/20261020140000_order_items_insert_guard.sql';
const m28 = 'supabase/migrations/20261020120000_security_definer_grants.sql';
const m30 = 'supabase/migrations/20261020130000_db_hardening_truncate_defaults.sql';
const with28 = has(m28), with30 = has(m30);
const order = (process.env.ORDER || '28,30').split(',');
console.log(`#28: ${with28 ? 'sì' : 'no'}, #30: ${with30 ? 'sì' : 'no'}, ordine ${order.join(' -> ')}`);
const fixtures = [
  ...(with30 ? ['tests/sql/db-hardening-schema.sql'] : []),
  // fixture di #28 (funzioni finte) prima della 20260904, così reserve_order_display_code è quella vera
  ...(with28 ? ['tests/sql/security-definer-grants-schema.sql'] : []),
  ...(with30 ? ['supabase/migrations/20260904_order_display_code_sequential.sql', 'supabase/migrations/20261013_enable_rls_order_daily_counters.sql'] : []),
];
const others = order.flatMap((n) => (n === '28' && with28 ? [m28] : n === '30' && with30 ? [m30] : []));
const base = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
  'supabase/migrations/20261013_order_manual_approval_guard.sql',
  'supabase/migrations/20261013140000_order_antiabuse.sql',
  ...fixtures,
  ...others,
  migration,
];
const suites = [
  [migration, 'tests/sql/order-items-insert-guard.sql'],
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ...(with28 ? [['tests/sql/security-definer-grants.sql']] : []),
  ...(with30 ? [['tests/sql/db-hardening.sql']] : []),
];
for (const suite of suites) {
  const db = new PGlite();
  for (const f of [...base, ...suite]) {
    const sql = fs.readFileSync(path.join(root, f), 'utf8').replace(/^\\set.*$/gm, '');
    try {
      const res = await db.exec(sql);
      const last = res.at(-1)?.rows?.[0];
      console.log('OK', f, last ? JSON.stringify(last) : '');
    } catch (e) {
      console.log('FAIL', f, e.message);
      process.exit(1);
    }
  }
}
console.log('ALL PASS');
