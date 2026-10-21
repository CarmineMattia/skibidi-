// Runner PGlite (nessun DB ospitato). Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-customer-company-menu-pglite.mjs
// Fixture con lo stato live (profili/menu/trigger di signup del 20/10), poi:
// 0) repro PRIMA della migration (cliente con company_id NULL -> menu vuoto);
// 1) 20261020170000_customer_company_menu.sql (due volte: idempotente) + tests/sql/customer-company-menu.sql.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = 'tests/sql/customer-company-menu-schema.sql';
const migration = 'supabase/migrations/20261020170000_customer_company_menu.sql';
async function run(db, files) {
  for (const f of files) {
    const sql = fs.readFileSync(path.join(root, f), 'utf8').replace(/^\\set.*$/gm, '');
    try {
      const res = await db.exec(sql);
      const last = res.at(-1)?.rows?.[0];
      console.log('OK', f, last ? JSON.stringify(last) : '');
    } catch (e) {
      console.log('FAIL', f, e.message, e.detail ?? '', e.where ?? '');
      process.exit(1);
    }
  }
}
console.log('== repro (before)');
await run(new PGlite(), [fixture, 'tests/sql/customer-company-menu-repro.sql']);
console.log('== fix');
await run(new PGlite(), [fixture, migration, migration, 'tests/sql/customer-company-menu.sql']);
console.log('== repro first, then fix (signup made before the fix is backfilled)');
await run(new PGlite(), [fixture, 'tests/sql/customer-company-menu-repro.sql', migration,
  'tests/sql/customer-company-menu.sql']);
console.log('ALL PASS');
