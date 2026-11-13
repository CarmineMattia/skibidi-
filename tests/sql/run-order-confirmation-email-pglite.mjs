// PGlite only. Proves the confirmation-email column is idempotent and that
// anon/authenticated cannot stamp it. No hosted database.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261113120000_order_confirmation_email.sql'), 'utf8');
const id = '00000000-0000-0000-0000-0000000000aa';
const customer = '00000000-0000-0000-0000-0000000000c1';

function fail(message) {
  console.log('FAIL', message);
  process.exit(1);
}

const db = new PGlite();
await db.exec(`
  CREATE TABLE public.orders (
    id uuid PRIMARY KEY,
    customer_id uuid,
    status text NOT NULL DEFAULT 'pending',
    updated_at timestamptz DEFAULT now()
  );
`);
await db.exec(migration);
await db.exec(migration);

const col = await db.query(`
  SELECT data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'confirmation_email_sent_at'
`);
if (col.rows.length !== 1 || col.rows[0].data_type !== 'timestamp with time zone' || col.rows[0].is_nullable !== 'YES') {
  fail(`column shape ${JSON.stringify(col.rows)}`);
}
console.log('PASS confirmation_email_sent_at is nullable timestamptz and the migration is re-runnable');

await db.query('INSERT INTO public.orders (id, customer_id) VALUES ($1, $2)', [id, customer]);
const first = await db.query(
  `UPDATE public.orders SET confirmation_email_sent_at = now()
   WHERE id = $1 AND customer_id = $2 AND confirmation_email_sent_at IS NULL
   RETURNING id`,
  [id, customer],
);
const second = await db.query(
  `UPDATE public.orders SET confirmation_email_sent_at = now()
   WHERE id = $1 AND customer_id = $2 AND confirmation_email_sent_at IS NULL
   RETURNING id`,
  [id, customer],
);
const otherCustomer = await db.query(
  `UPDATE public.orders SET confirmation_email_sent_at = now()
   WHERE id = $1 AND customer_id = $2 AND confirmation_email_sent_at IS NULL
   RETURNING id`,
  [id, '00000000-0000-0000-0000-0000000000c2'],
);
if (first.rows.length !== 1 || second.rows.length !== 0 || otherCustomer.rows.length !== 0) {
  fail(`claim counts first=${first.rows.length} second=${second.rows.length} other=${otherCustomer.rows.length}`);
}
console.log('PASS one claim per order, and only for that customer');

await db.exec(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
`);
await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
const before = await db.query('SELECT confirmation_email_sent_at::text AS t FROM public.orders WHERE id = $1', [id]);
await db.query(
  `UPDATE public.orders SET confirmation_email_sent_at = now() + interval '1 day', status = 'accepted' WHERE id = $1`,
  [id],
);
const after = await db.query('SELECT confirmation_email_sent_at::text AS t, status FROM public.orders WHERE id = $1', [id]);
if (after.rows[0]?.status !== 'accepted' || after.rows[0]?.t !== before.rows[0]?.t) {
  fail(`authenticated lock before=${before.rows[0]?.t} after=${JSON.stringify(after.rows[0])}`);
}
console.log('PASS authenticated cannot change confirmation_email_sent_at');

await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
await db.query('UPDATE public.orders SET confirmation_email_sent_at = NULL WHERE id = $1', [id]);
const cleared = await db.query('SELECT confirmation_email_sent_at AS t FROM public.orders WHERE id = $1', [id]);
if (cleared.rows[0]?.t != null) fail('service_role could not clear the claim');
console.log('PASS service_role can record the claim');
console.log('ALL PASS');
