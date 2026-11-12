// Runner PGlite (nessun DB ospitato). Uso: npm run test:sql -- security-hardening
// Hosted Supabase applies migrations as postgres, which does not own
// storage.objects / storage.buckets (owner: supabase_storage_admin).
// CREATE/DROP POLICY and bucket DML are allowed; ALTER TABLE is not (42501).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = 'supabase/migrations/20261111234500_security_hardening.sql';
const followUp = 'supabase/migrations/20261112003000_company_storage_and_orders_anon.sql';
const linePrice = 'supabase/migrations/20261112010000_order_item_price_and_company.sql';
const schemaFile = 'tests/sql/security-hardening-schema.sql';
const files = [
  schemaFile,
  migration,
  migration,
  followUp,
  followUp,
  linePrice,
  linePrice,
  'tests/sql/security-hardening.sql',
];

const storageAlter = /ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?storage\./i;
const unsafeStorageDrop = /DROP\s+POLICY\s+(?!IF\s+EXISTS)[^;]*\bON\s+storage\./i;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function fail(message) {
  console.log('FAIL', message);
  process.exit(1);
}

const migrationDir = path.join(root, 'supabase/migrations');
for (const name of fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql'))) {
  const sql = fs.readFileSync(path.join(migrationDir, name), 'utf8');
  if (storageAlter.test(sql)) fail(`${name} contains ALTER TABLE storage.`);
  if (unsafeStorageDrop.test(sql)) fail(`${name} drops a storage policy without IF EXISTS`);
}
console.log('OK no migration contains ALTER TABLE storage.');

const migrationSql = read(migration);
const storageBlock = migrationSql.match(/DO \$storage\$[\s\S]*?\n\$storage\$;/);
if (!storageBlock) fail('storage block not found in ' + migration);

async function expectError(db, sql, pattern, label) {
  try {
    await db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) fail(`${label}: ${message}`);
    console.log('OK', label);
    return;
  }
  fail(`${label} was allowed`);
}

// The bucket upsert and the relrowsecurity guard do not need ownership.
// Run that block as a non-owner, including when RLS was left off: it must
// warn and continue, and it must not turn RLS on (that would be owner DDL).
{
  const bare = new PGlite();
  await bare.exec(`
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text,
      public boolean,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (id uuid, bucket_id text, name text);
    CREATE ROLE supabase_storage_admin NOLOGIN;
    CREATE ROLE hosted_postgres NOLOGIN NOSUPERUSER NOBYPASSRLS;
    ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
    ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
    GRANT USAGE ON SCHEMA storage TO hosted_postgres;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets, storage.objects TO hosted_postgres;
  `);
  await bare.exec('SET ROLE hosted_postgres');
  try {
    await bare.exec(storageBlock[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`non-owner storage block: ${message}`);
  } finally {
    await bare.exec('RESET ROLE');
  }
  const state = (await bare.query(`
    SELECT
      (SELECT c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage' AND c.relname = 'objects') AS rls,
      (SELECT file_size_limit FROM storage.buckets WHERE id = 'products') AS lim,
      (SELECT public FROM storage.buckets WHERE id = 'products') AS pub
  `)).rows[0];
  if (state.rls !== false || state.pub !== true || Number(state.lim) !== 5242880) {
    fail(`non-owner storage block left ${JSON.stringify(state)}`);
  }
  await expectError(
    bare,
    'SET ROLE hosted_postgres; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;',
    /must be owner of table objects/,
    'non-owner role rejects ALTER TABLE storage.objects'
  );
  await bare.exec('RESET ROLE');
  console.log('OK storage block applies as a non-owner and leaves RLS untouched');
}

const db = new PGlite();
try {
  await db.exec(read(schemaFile));
  console.log('OK', schemaFile);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`${schemaFile} ${message}`);
}

await expectError(
  db,
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY',
  /must be owner of table objects/,
  'hosted emulation rejects ALTER TABLE storage.objects'
);
await db.exec(`
  CREATE POLICY hosted_policy_probe ON storage.objects FOR SELECT TO authenticated USING (false);
  DROP POLICY IF EXISTS hosted_policy_probe ON storage.objects;
`);
console.log('OK hosted emulation still allows CREATE/DROP POLICY on storage.objects');

for (const file of files.slice(1)) {
  const sql = read(file);
  try {
    await db.exec(sql);
    console.log('OK', file);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${file} ${message}`);
  }
}
console.log('ALL PASS');
