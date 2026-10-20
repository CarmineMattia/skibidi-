// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-order-items-insert-guard-pglite.mjs
// Catena ordini + 20261020140000_order_items_insert_guard.sql (due volte: idempotente), poi
// tests/sql/order-items-insert-guard.sql e i test esistenti con la guardia applicata.
// Se nel checkout ci sono #28 e/o #30 vengono applicati prima (ordine: ORDER=28,30 o ORDER=30,28)
// e vengono rieseguiti anche i loro test.
// Con #28 e #30 entrambi presenti: test delle 6 permutazioni di #28/#30/#32 (ognuna applicata
// due volte): policy/grant/default privileges finali identici e test di sicurezza verdi per ognuna.
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
const chain = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
  'supabase/migrations/20261013_order_manual_approval_guard.sql',
  'supabase/migrations/20261013140000_order_antiabuse.sql',
  ...(with30 ? ['tests/sql/db-hardening-schema.sql'] : []),
  // fixture di #28 (funzioni finte) prima della 20260904, così reserve_order_display_code è quella vera
  ...(with28 ? ['tests/sql/security-definer-grants-schema.sql'] : []),
  'tests/sql/order-items-insert-guard-schema.sql',
  'supabase/migrations/20260904_order_display_code_sequential.sql',
  'supabase/migrations/20261013_enable_rls_order_daily_counters.sql',
];
const others = order.flatMap((n) => (n === '28' && with28 ? [m28] : n === '30' && with30 ? [m30] : []));
const base = [...chain, ...others, migration];
const suites = [
  [migration, 'tests/sql/order-items-insert-guard.sql'],
  ['tests/sql/atomic-order-submission.sql'],
  ['tests/sql/order-antiabuse.sql'],
  ['tests/sql/manual-approval-states.sql'],
  ...(with28 ? [['tests/sql/security-definer-grants.sql']] : []),
  ...(with30 ? [['tests/sql/db-hardening.sql']] : []),
];
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
for (const suite of suites) await run(new PGlite(), [...base, ...suite]);

if (with28 && with30) {
  const snapshotSql = `SELECT jsonb_build_object(
    'policies', (SELECT jsonb_agg(jsonb_build_array(tablename, policyname, cmd, roles::text, qual, with_check) ORDER BY tablename, policyname)
                 FROM pg_policies WHERE schemaname = 'public'),
    'functions', (SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text, p.proacl::text, p.prosecdef, p.proconfig::text, md5(p.prosrc)) ORDER BY p.oid::regprocedure::text)
                  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace),
    'tables', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relacl::text, c.relrowsecurity) ORDER BY c.relname)
               FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','S')),
    'default_acl', (SELECT jsonb_agg(jsonb_build_array(defaclrole::regrole::text, defaclnamespace, defaclobjtype, defaclacl::text) ORDER BY 1,2,3)
                    FROM pg_default_acl)
  )::text AS snap`;
  const perms = [[m28, m30, migration], [m28, migration, m30], [m30, m28, migration],
                 [m30, migration, m28], [migration, m28, m30], [migration, m30, m28]];
  const label = (p) => p.map((f) => (f === m28 ? '28' : f === m30 ? '30' : '32')).join('->');
  const snaps = [];
  for (const p of perms) {
    const db = new PGlite();
    await run(db, [...chain, ...p, ...p], true);
    snaps.push((await db.query(snapshotSql)).rows[0].snap);
    // sicurezza: guardia ordini + test di #28 e #30 su DB nuovi con la stessa permutazione
    await run(db, ['tests/sql/order-items-insert-guard.sql'], true);
    await run(new PGlite(), [...chain, ...p, ...p, 'tests/sql/security-definer-grants.sql'], true);
    await run(new PGlite(), [...chain, ...p, ...p, 'tests/sql/db-hardening.sql'], true);
    console.log(`OK permutazione ${label(p)} (x2): guardia, #28, #30 PASS`);
  }
  const diff = snaps.findIndex((s) => s !== snaps[0]);
  if (diff !== -1) {
    console.log(`FAIL permutazioni: ${label(perms[diff])} diversa da ${label(perms[0])}`);
    fs.writeFileSync('/tmp/perm-a.json', snaps[0]);
    fs.writeFileSync('/tmp/perm-b.json', snaps[diff]);
    process.exit(1);
  }
  console.log('OK 6 permutazioni: policy/grant/default privileges identici');
}
console.log('ALL PASS');
