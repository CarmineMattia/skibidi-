// Runner PGlite (nessun DB ospitato) per la pulizia dei 16 ordini vuoti.
// Uso: npm i --no-save @electric-sql/pglite && node tests/sql/run-cleanup-empty-orders-pglite.mjs
// Esegue backup -> pulizia -> ripristino sulla fixture tests/sql/cleanup-empty-orders-schema.sql
// e i casi in cui la pulizia deve annullarsi senza cancellare nulla.
import { PGlite } from '@electric-sql/pglite';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRestoreSql } from '../../scripts/sql/make-restore-empty-orders.mjs';

const root = process.env.SKIBIDI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const fixture = read('tests/sql/cleanup-empty-orders-schema.sql');
const backupSql = read('scripts/sql/cleanup-empty-orders-2026-10-backup.sql');
const cleanupSql = read('scripts/sql/cleanup-empty-orders-2026-10.sql');
const restoreTemplate = read('scripts/sql/cleanup-empty-orders-2026-10-restore.sql');

const idRe = /'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/g;
const idsOf = (sql) => [...sql.matchAll(idRe)].map((m) => m[1]);

let passed = 0;
const ok = (name) => { passed += 1; console.log('PASS', name); };

async function fresh() {
  const db = new PGlite();
  await db.exec(fixture);
  return db;
}
async function exec(db, sql) {
  try {
    return { res: await db.exec(sql) };
  } catch (e) {
    await db.exec('ROLLBACK').catch(() => {});
    return { error: e };
  }
}
async function one(db, sql) {
  return (await db.query(sql)).rows[0];
}
async function state(db) {
  return one(db, `SELECT (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM order_items) AS items,
    (SELECT count(*)::int FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)) AS empty`);
}
async function dump(db) {
  // total_amount normalizzato: il JSON del backup passa per un parser JS (13.50 -> 13.5), stesso valore.
  return (await db.query(`SELECT (to_jsonb(o) || jsonb_build_object('total_amount', o.total_amount::numeric(12,2)::text))::text AS j
    FROM orders o ORDER BY id`)).rows.map((r) => r.j);
}
async function backup(db) {
  const { res, error } = await exec(db, backupSql);
  if (error) throw error;
  const row = res.find((r) => r.rows?.length)?.rows[0];
  return row;
}

// 0) Le tre liste di id sono identiche, 16 id distinti, e coincidono con il piano dati.
const expected = [...read('docs/piano-dati-2026-10-21.md').split('### Opzioni')[0]
  .matchAll(/`([0-9a-f]{8}-[0-9a-f-]{27})`/g)].map((m) => m[1]);
assert.equal(new Set(expected).size, 16, 'il piano dati elenca 16 id');
for (const [name, sql] of [['backup', backupSql], ['cleanup', cleanupSql], ['restore', restoreTemplate]]) {
  const ids = idsOf(sql);
  assert.equal(ids.length, 16, `${name}: 16 id`);
  assert.deepEqual([...ids].sort(), [...expected].sort(), `${name}: stessi id del piano dati`);
}
ok('stessi 16 id in backup, pulizia, ripristino e piano dati');

// 1) Percorso completo: backup -> pulizia -> rerun -> ripristino -> rerun ripristino.
{
  const db = await fresh();
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  const before = await dump(db);

  const b = await backup(db);
  assert.equal(Number(b.order_count), 16);
  assert.equal(Number(b.item_count), 0);
  assert.equal(Number(b.ref_count), 0);
  assert.equal(b.backup.orders.length, 16);
  assert.equal(b.backup.totals.orders_total, 37);
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 }, 'il backup non cambia nulla');
  ok('backup in sola lettura: 16 ordini, 0 righe, 0 riferimenti');

  const ro = await exec(db, backupSql.replace('ROLLBACK;', "DELETE FROM orders; ROLLBACK;"));
  assert.match(String(ro.error?.message), /read-only/i, 'il backup gira in una transazione READ ONLY');
  ok('backup protetto da BEGIN READ ONLY');

  const c = await exec(db, cleanupSql);
  assert.equal(c.error, undefined, c.error?.message);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  const after = c.res.at(-1).rows[0];
  assert.deepEqual({ ...after }, { orders_total: 21, order_items_total: 42, empty_orders_total: 0 });
  ok('pulizia: cancellati 16, restano 21 ordini e 42 righe, nessun ordine vuoto');

  const again = await exec(db, cleanupSql);
  assert.match(String(again.error?.message), /CLEANUP_ABORT: attesi 16 ordini, trovati 0/);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('rieseguire la pulizia si annulla e non cambia nulla');

  const restoreSql = buildRestoreSql(restoreTemplate, JSON.stringify([b]));
  const r = await exec(db, restoreSql);
  assert.equal(r.error, undefined, r.error?.message);
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  const restored = await dump(db);
  const diff = restored.filter((j) => !before.includes(j));
  assert.deepEqual(diff, [], 'ordini ripristinati identici (stato, codice, date)');
  assert.equal(restored.length, before.length);
  ok('ripristino: 16 ordini identici al backup');

  const trg = await exec(db, `INSERT INTO orders (status, total_amount, company_id)
    VALUES ('delivered', 1, '00000000-0000-0000-0000-000000000001')`);
  assert.match(String(trg.error?.message), /must start as pending/, 'trigger riattivati dopo il ripristino');
  const dc = await one(db, `INSERT INTO orders (total_amount, company_id, display_code)
    VALUES (1, '00000000-0000-0000-0000-000000000001', 'X') RETURNING display_code`);
  assert.match(dc.display_code, /^NUOVO #/);
  await db.exec(`DELETE FROM orders WHERE display_code LIKE 'NUOVO #%'`);
  ok('trigger di orders di nuovo attivi dopo il ripristino');

  const r2 = await exec(db, restoreSql);
  assert.equal(r2.error, undefined, r2.error?.message);
  assert.deepEqual(await dump(db), before);
  ok('ripristino rieseguibile senza cambiare nulla');

  const c2 = await exec(db, cleanupSql);
  assert.equal(c2.error, undefined, c2.error?.message);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('pulizia di nuovo possibile dopo il ripristino');
}

// 2) Casi in cui la pulizia deve annullarsi senza cancellare nulla.
const abortCases = [
  ['un ordine della lista ha ora una riga', `INSERT INTO order_items (order_id, unit_price) VALUES ('0d050c47-a5f1-456c-9aec-8e2b7ca9ced2', 5)`, /CLEANUP_ABORT: 1 order_items/, { orders: 37, items: 43, empty: 15 }],
  ['un ordine della lista non esiste più', `DELETE FROM orders WHERE id = 'a1af41ad-53f6-49f6-ab3b-cd3c884514ff'`, /attesi 16 ordini, trovati 15/, { orders: 36, items: 42, empty: 15 }],
  ['riferimento in order_no_shows', `INSERT INTO order_no_shows (order_id) VALUES ('d7c6ef59-9d66-43ab-9860-f67b79f8fdbc')`, /CLEANUP_ABORT: 1 righe fiscali/, { orders: 37, items: 42, empty: 16 }],
  ['riferimento in fiscal_audit_log', `INSERT INTO fiscal_audit_log (order_id) VALUES ('aaa97d25-ac70-4429-8ec8-6e6503aca940')`, /CLEANUP_ABORT: 1 righe fiscali/, { orders: 37, items: 42, empty: 16 }],
  ['riferimento in fiscal_retry_queue', `INSERT INTO fiscal_retry_queue (order_id) VALUES ('aaa97d25-ac70-4429-8ec8-6e6503aca940')`, /CLEANUP_ABORT: 1 righe fiscali/, { orders: 37, items: 42, empty: 16 }],
];
for (const [name, setup, re, expectState] of abortCases) {
  const db = await fresh();
  await db.exec(setup);
  const res = await exec(db, cleanupSql);
  assert.match(String(res.error?.message), re, name);
  assert.deepEqual(await state(db), expectState, `${name}: nessuna riga cancellata`);
  ok(`annulla se ${name}`);
}

// 3) Un nuovo ordine vuoto NON in lista non viene toccato: si cancellano solo i 16 id espliciti.
{
  const db = await fresh();
  await db.exec(`INSERT INTO orders (total_amount, company_id) VALUES (9, '00000000-0000-0000-0000-000000000001')`);
  const res = await exec(db, cleanupSql);
  assert.equal(res.error, undefined, res.error?.message);
  assert.deepEqual(await state(db), { orders: 22, items: 42, empty: 1 });
  ok('cancella solo i 16 id della lista (un nuovo ordine vuoto resta)');
}

// 4) Il ripristino rifiuta backup sbagliati.
{
  assert.throws(() => buildRestoreSql(restoreTemplate, '{"kind":"altro"}'), /Backup non valido/);
  assert.throws(() => buildRestoreSql(restoreTemplate, JSON.stringify({ kind: 'skibidi-cleanup-empty-orders-2026-10', orders: [] })), /attesi 16 ordini/);
  const db = await fresh();
  const b = await backup(db);
  const tampered = structuredClone(b.backup);
  tampered.orders[0].id = '11111111-1111-1111-1111-111111111111';
  await exec(db, cleanupSql);
  const res = await exec(db, buildRestoreSql(restoreTemplate, tampered));
  assert.match(String(res.error?.message), /RESTORE_ABORT: il backup non contiene esattamente i 16 ordini attesi/);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  const unfilled = await exec(db, restoreTemplate);
  assert.ok(unfilled.error, 'il template senza backup non si può eseguire');
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('ripristino: rifiuta backup estranei/manomessi e il template non compilato');
}

console.log(`ALL PASS (${passed})`);
