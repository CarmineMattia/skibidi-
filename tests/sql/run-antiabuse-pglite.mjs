// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-antiabuse-pglite.mjs
// Se nel checkout ci sono anche le migration di #18 (approvazione manuale) vengono applicate:
// così lo stesso runner verifica sia #11+#20 sia la combo #11+#18+#20.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const optional = (f) => (fs.existsSync(path.join(root, f)) ? [f] : []);
const approval = optional('supabase/migrations/20261013_order_manual_approval_guard.sql');
console.log(approval.length ? 'Con #18 (approvazione manuale)' : 'Senza #18');
const base = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
  ...approval,
  'supabase/migrations/20261013140000_order_antiabuse.sql',
];
const suites = [
  ['tests/sql/atomic-order-submission.sql'],
  // la migration rigira due volte senza errori
  ['supabase/migrations/20261013140000_order_antiabuse.sql', 'tests/sql/order-antiabuse.sql'],
  ...(approval.length ? [optional('tests/sql/manual-approval-states.sql')] : []),
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
