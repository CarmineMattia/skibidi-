// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-db-hardening-pglite.mjs
// Catena ordini + fixture con i grant larghi di prod + migration di hardening (due volte:
// idempotente), poi tests/sql/db-hardening.sql e i test esistenti con l'hardening applicato.
// Se nel checkout c'è anche la migration di #28 (security definer grants) viene applicata prima.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const optional = (f) => (fs.existsSync(path.join(root, f)) ? [f] : []);
const migration = 'supabase/migrations/20261020130000_db_hardening_truncate_defaults.sql';
const pr28 = [...optional('tests/sql/security-definer-grants-schema.sql'), ...optional('supabase/migrations/20261020120000_security_definer_grants.sql')];
console.log(pr28.length ? 'Con #28 (security definer grants)' : 'Senza #28');
const base = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
  'supabase/migrations/20261013_order_manual_approval_guard.sql',
  'supabase/migrations/20261013140000_order_antiabuse.sql',
  'tests/sql/db-hardening-schema.sql',
  // Il fixture di #28 definisce un reserve_order_display_code finto: va prima della
  // migration 20260904, così i test girano con la funzione vera (nota del tester su #28).
  ...pr28.slice(0, 1),
  'supabase/migrations/20260904_order_display_code_sequential.sql',
  'supabase/migrations/20261013_enable_rls_order_daily_counters.sql',
  ...pr28.slice(1),
  migration,
];
const suites = [
  [migration, 'tests/sql/db-hardening.sql'],
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ...(pr28.length ? [optional('tests/sql/security-definer-grants.sql')] : []),
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
