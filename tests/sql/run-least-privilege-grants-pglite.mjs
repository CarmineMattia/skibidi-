// Runner PGlite (nessun DB ospitato). Uso: npm run test:sql -- least-privilege
// Catena ordini + #28/#30/#32/#33/#34/#44 (come run-staff-receipt), poi il fixture con i grant
// larghi di prod, poi 20261029100000_least_privilege_table_grants.sql DUE volte (idempotente:
// stesso snapshot di ACL e default privileges), poi tests/sql/least-privilege-grants.sql e tutte
// le suite ordini/permessi esistenti con la migration applicata (RLS e RPC devono funzionare uguale).
// I file di migration sono risolti per nome (senza il prefisso di versione) cosi' il runner
// resta valido se una migration viene rinominata (es. versioni uniche nella PR sulla storia).
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migDir = 'supabase/migrations';
function resolve(f) {
  if (fs.existsSync(path.join(root, f))) return f;
  if (!f.startsWith(migDir + '/')) throw new Error('missing ' + f);
  const stem = path.basename(f).replace(/^\d+_/, '');
  const hit = fs.readdirSync(path.join(root, migDir)).filter((x) => x.endsWith('_' + stem));
  if (hit.length !== 1) throw new Error(`cannot resolve ${f} (${hit.length} matches)`);
  return `${migDir}/${hit[0]}`;
}
const migration = `${migDir}/20261029100000_least_privilege_table_grants.sql`;
const chain = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  `${migDir}/20260610_tighten_orders_rls_tracking_rpc.sql`,
  `${migDir}/20260901_fix_guest_order_items_rls.sql`,
  `${migDir}/20261008_atomic_order_submission.sql`,
  `${migDir}/20261013_order_manual_approval_guard.sql`,
  `${migDir}/20261013140000_order_antiabuse.sql`,
  'tests/sql/db-hardening-schema.sql',
  'tests/sql/security-definer-grants-schema.sql',
  'tests/sql/order-items-insert-guard-schema.sql',
  `${migDir}/20260904_order_display_code_sequential.sql`,
  `${migDir}/20261013_enable_rls_order_daily_counters.sql`,
  `${migDir}/20261020120000_security_definer_grants.sql`,
  `${migDir}/20261020130000_db_hardening_truncate_defaults.sql`,
  `${migDir}/20261020140000_order_items_insert_guard.sql`,
  'tests/sql/server-pricing-schema.sql',
  `${migDir}/20261020150000_server_side_pricing.sql`,
  'tests/sql/customer-order-lock-schema.sql',
  `${migDir}/20261020160000_customer_order_update_lock.sql`,
  'tests/sql/server-receipt-status-schema.sql',
  `${migDir}/20261023100000_server_side_receipt_status.sql`,
  'tests/sql/staff-receipt-schema.sql',
  `${migDir}/20261023140000_staff_receipt_issue.sql`,
];
async function run(db, files, quiet = false) {
  for (const f of files) {
    const sql = fs.readFileSync(path.join(root, resolve(f)), 'utf8').replace(/^\\set.*$/gm, '');
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
async function aclSnapshot(db) {
  const rel = await db.query(`select c.relname, c.relkind::text, coalesce(c.relacl::text,'') acl from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','S') order by 1`);
  const def = await db.query(`select pg_get_userbyid(defaclrole) r, defaclobjtype::text t, defaclacl::text a from pg_default_acl
    where defaclnamespace = 'public'::regnamespace order by 1,2`);
  return JSON.stringify([rel.rows, def.rows]);
}

const base = [...chain, 'tests/sql/least-privilege-grants-schema.sql'];
{
  const db = new PGlite();
  await run(db, base, true);
  await run(db, [migration]);
  const first = await aclSnapshot(db);
  await run(db, [migration], true);
  if ((await aclSnapshot(db)) !== first) { console.log('FAIL migration is not idempotent'); process.exit(1); }
  console.log('OK idempotent (ACL and default privileges identical after a second run)');
  await run(db, ['tests/sql/least-privilege-grants.sql']);
}
for (const suite of [
  ['tests/sql/server-receipt-status.sql'],
  ['tests/sql/staff-receipt.sql'],
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ['tests/sql/security-definer-grants.sql'],
  ['tests/sql/db-hardening.sql'],
  ['tests/sql/order-items-insert-guard.sql'],
]) {
  const db = new PGlite();
  await run(db, [...base, migration], true);
  await run(db, suite, true);
  console.log('OK', suite[0], 'with the migration applied');
}
console.log('ALL PASS');
