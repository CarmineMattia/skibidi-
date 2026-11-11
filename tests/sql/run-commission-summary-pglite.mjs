// Runner PGlite (nessun DB ospitato, nessuna credenziale). Uso:
//   npm run test:sql -- commission-summary
// Applica due volte 20261111180000 (idempotente) sulla fixture e esegue i casi.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  'tests/sql/commission-summary-schema.sql',
  'supabase/migrations/20261111180000_online_order_commission_summary.sql',
  'supabase/migrations/20261111180000_online_order_commission_summary.sql',
  'tests/sql/commission-summary.sql',
];

const db = new PGlite();
for (const file of files) {
  const sql = fs.readFileSync(path.join(root, file), 'utf8');
  try {
    await db.exec(sql);
    console.log('OK', file);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log('FAIL', file, err.message);
    process.exit(1);
  }
}
console.log('ALL PASS');
