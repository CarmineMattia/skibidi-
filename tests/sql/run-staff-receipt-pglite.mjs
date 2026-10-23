// Runner PGlite (nessun DB ospitato). Uso: npm run test:sql -- staff-receipt
// Catena ordini + #28/#30/#32/#33/#34/#44 (stesse fixture di run-server-receipt-status),
// poi 20261023140000_staff_receipt_issue.sql (due volte: idempotente) e:
// 1) tests/sql/staff-receipt.sql ("Emetti scontrino": chi può, lease, esito, niente altro cambia);
// 2) le suite esistenti (scontrino lato server, ordini, permessi) con la migration applicata.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261023140000_staff_receipt_issue.sql';
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
  'tests/sql/customer-order-lock-schema.sql',
  'supabase/migrations/20261020160000_customer_order_update_lock.sql',
  'tests/sql/server-receipt-status-schema.sql',
  'supabase/migrations/20261023100000_server_side_receipt_status.sql',
  'tests/sql/staff-receipt-schema.sql',
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

const base = [...chain, migration, migration];
await run(new PGlite(), [...base, 'tests/sql/staff-receipt.sql']);
for (const suite of [
  ['tests/sql/server-receipt-status.sql'],
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ['tests/sql/security-definer-grants.sql'],
  ['tests/sql/db-hardening.sql'],
  ['tests/sql/order-items-insert-guard.sql'],
]) await run(new PGlite(), [...base, ...suite], true);
console.log('OK existing suites with the migration applied');
console.log('ALL PASS');
