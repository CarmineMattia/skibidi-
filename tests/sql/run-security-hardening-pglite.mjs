// Runner PGlite (nessun DB ospitato). Uso: npm run test:sql -- security-hardening
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261111234500_security_hardening.sql';
const files = [
  'tests/sql/security-hardening-schema.sql',
  migration,
  migration,
  'tests/sql/security-hardening.sql',
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
