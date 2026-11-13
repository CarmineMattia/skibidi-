// Runner PGlite (nessun DB ospitato). Le 6 migration ricostruite da prod (solo nel repo) non
// devono rompere un database nuovo, devono essere rieseguibili e non devono toccare il tenant
// "Pizzeria Ambrosia" (id ...0001) se rieseguite per errore.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const m = (f) => fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8');
const SIX = [
  '20260117194108_create_product_images_storage_bucket.sql',
  '20260724140614_skibidi_demo_branding.sql',
  '20260724143416_skibidi_demo_contact.sql',
  '20260724152401_skibidi_demo_menu_images.sql',
  '20260901223534_fix_can_insert_order_item_guest_scope.sql',
  '20260901224024_fix_can_insert_order_item_column.sql',
];
const CID = '00000000-0000-0000-0000-000000000001';
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  if (!ok) failed++;
};
const roles = `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;`;

// 1) Database nuovo, senza tabelle né schema storage: nessun errore, due volte.
{
  const db = new PGlite();
  await db.exec(roles);
  let err = '';
  try { for (let i = 0; i < 2; i++) for (const f of SIX) await db.exec(m(f)); } catch (e) { err = e.message; }
  check('db vuoto: le 6 migration passano due volte senza errori', !err, err);
}

// 2) Schema base minimo + storage finto.
const schema = `${roles}
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.companies (id uuid PRIMARY KEY, name text, slug text, settings jsonb);
CREATE TABLE public.categories (id uuid PRIMARY KEY, company_id uuid, name text);
CREATE TABLE public.products (id uuid PRIMARY KEY, company_id uuid, category_id uuid, name text, image_url text);`;
const seed = (company) => `
INSERT INTO public.companies VALUES ('${CID}', '${company}', 'demo', '{"keep":1}');
INSERT INTO public.categories VALUES ('c0000000-0000-0000-0000-000000000001','${CID}','Pizze Bianche'),('c0000000-0000-0000-0000-000000000002','${CID}','Bevande');
INSERT INTO public.products VALUES
 ('a0000000-0000-0000-0000-000000000001','${CID}','c0000000-0000-0000-0000-000000000001','Ambrosia','assets/real-photo.webp'),
 ('a0000000-0000-0000-0000-000000000002','${CID}','c0000000-0000-0000-0000-000000000002','Acqua','assets/real-water.webp');`;
const state = async (db) => (await db.query(`SELECT (SELECT name FROM public.companies) cname, (SELECT settings::text FROM public.companies) cset,
  (SELECT string_agg(name||'='||coalesce(image_url,''), '|' ORDER BY id) FROM public.products) prods`)).rows[0];

// 2a) Tenant già Pizzeria Ambrosia: i dati non cambiano (nemmeno rieseguendo).
{
  const db = new PGlite();
  await db.exec(schema); await db.exec(seed('Pizzeria Ambrosia'));
  const before = await state(db);
  let err = '';
  try { for (let i = 0; i < 2; i++) for (const f of SIX) await db.exec(m(f)); } catch (e) { err = e.message; }
  const after = await state(db);
  check('Ambrosia: nessun errore', !err, err);
  check('Ambrosia: nome, settings, prodotti e foto invariati', JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));
}

// 2b) Tenant demo (non Ambrosia): le migration di dati si applicano e sono rieseguibili.
{
  const db = new PGlite();
  await db.exec(schema); await db.exec(seed('Demo'));
  let err = '';
  try { for (let i = 0; i < 2; i++) for (const f of SIX) await db.exec(m(f)); } catch (e) { err = e.message; }
  const s = await state(db);
  check('demo: nessun errore, due volte', !err, err);
  check('demo: branding applicato', s.cname === 'Skibidi Kitchen' && s.cset.includes('Ordina. Ritira. A tavola.') && s.cset.includes('"keep": 1'), s.cname);
  check('demo: contatti applicati', s.cset.includes('Via Demo 1'));
  check('demo: pizza rinominata e foto Unsplash', s.prods.includes('Bufala e Pesto=https://images.unsplash.com/') && s.prods.includes('Acqua=https://images.unsplash.com/photo-1527960471264'), s.prods);
}

// 2c) Storage: bucket e 4 policy create, senza duplicati alla seconda esecuzione.
{
  const db = new PGlite();
  await db.exec(schema);
  let err = '';
  try { for (let i = 0; i < 2; i++) await db.exec(m(SIX[0])); } catch (e) { err = e.message; }
  const b = (await db.query(`SELECT count(*)::int n, bool_or(public) pub, max(file_size_limit)::int lim FROM storage.buckets WHERE id='products'`)).rows[0];
  const p = (await db.query(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='storage' AND tablename='objects'`)).rows[0];
  check('storage: nessun errore, due volte', !err, err);
  check('storage: 1 bucket pubblico da 5 MB e 4 policy', b.n === 1 && b.pub && b.lim === 5242880 && p.n === 4, JSON.stringify({ b, p }));
}

// 3) can_insert_order_item: funzione creata, grant come su prod (anon + authenticated), rieseguibile.
{
  const db = new PGlite();
  await db.exec(roles);
  let err = '';
  try { for (let i = 0; i < 2; i++) { await db.exec(m(SIX[4])); await db.exec(m(SIX[5])); } } catch (e) { err = e.message; }
  const r = (await db.query(`SELECT pg_get_functiondef(p.oid) def, has_function_privilege('anon', p.oid, 'EXECUTE') a, has_function_privilege('authenticated', p.oid, 'EXECUTE') u
    FROM pg_proc p WHERE proname='can_insert_order_item'`)).rows;
  check('can_insert_order_item: una sola funzione, ultima versione (unit_price)', !err && r.length === 1 && r[0].def.includes('oi.unit_price') && !r[0].def.includes('oi.price'), err);
  check('can_insert_order_item: EXECUTE ad anon e authenticated come su prod', r[0]?.a && r[0]?.u);
}

// 4) 20260904 (NON registrata su prod): CREATE OR REPLACE non deve riaprire EXECUTE (live: solo postgres e service_role).
{
  const db = new PGlite();
  await db.exec(roles);
  await db.exec(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;
    CREATE TABLE public.order_daily_counters (company_id uuid, day date, counter int, PRIMARY KEY (company_id, day));
    CREATE FUNCTION public.reserve_order_display_code(p_company_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT 'Diavola #1' $$;
    REVOKE EXECUTE ON FUNCTION public.reserve_order_display_code(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.reserve_order_display_code(uuid) TO service_role;`);
  let err = '';
  try { await db.exec(m('20260904_order_display_code_sequential.sql')); } catch (e) { err = e.message; }
  const r = (await db.query(`SELECT has_function_privilege('anon', p.oid, 'EXECUTE') a, has_function_privilege('authenticated', p.oid, 'EXECUTE') u,
    has_function_privilege('service_role', p.oid, 'EXECUTE') s, pg_get_functiondef(p.oid) def FROM pg_proc p WHERE proname='reserve_order_display_code'`)).rows[0];
  const code = (await db.query(`SELECT public.reserve_order_display_code('${CID}') c1, public.reserve_order_display_code('${CID}') c2`)).rows[0];
  check('20260904: ACL invariata (anon/authenticated no, service_role sì)', !err && !r.a && !r.u && r.s, err);
  check('20260904: codici "Ordine #N" progressivi', code.c1 === 'Ordine #1' && code.c2 === 'Ordine #2', JSON.stringify(code));
}

if (failed) { console.log(`FAIL ${failed} controlli`); process.exit(1); }
console.log('ALL PASS');
