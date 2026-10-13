// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-antiabuse-pglite.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const suites = [
  // Regressione: l'ordine atomico (da ospite) prima dell'antiabuso.
  ['tests/sql/atomic-order-submission.sql'],
  ['supabase/migrations/20261013140000_order_antiabuse.sql', 'supabase/migrations/20261013140000_order_antiabuse.sql', 'tests/sql/order-antiabuse.sql'],
];
const base = [
  'tests/sql/atomic-order-schema.sql',
  'tests/sql/antiabuse-schema.sql',
  'supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql',
  'supabase/migrations/20260901_fix_guest_order_items_rls.sql',
  'supabase/migrations/20261008_atomic_order_submission.sql',
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
