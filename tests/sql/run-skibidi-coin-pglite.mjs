// Runner PGlite (nessun DB ospitato). Uso: npm run test:sql -- skibidi-coin
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261112020000_skibidi_coin.sql';
const files = [
  'tests/sql/skibidi-coin-schema.sql',
  migration,
  migration,
  'tests/sql/skibidi-coin.sql',
];

const db = new PGlite();
for (const file of files) {
  const sql = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\\set.*$/gm, '');
  try {
    const res = await db.exec(sql);
    const last = res.at(-1)?.rows?.[0];
    console.log('OK', file, last ? JSON.stringify(last) : '');
  } catch (error) {
    console.log('FAIL', file, error.message, error.detail ?? '', error.where ?? '');
    process.exit(1);
  }
}
console.log('ALL PASS');
