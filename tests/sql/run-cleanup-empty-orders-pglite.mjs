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
// cancellazione vera: si toglie il "-- " davanti al flag locale subito dopo BEGIN (copia del file)
const CONFIRM_LINE = "SELECT set_config('skibidi.cleanup_confirm', 'CANCELLA-16-ORDINI-VUOTI', true);";
assert.equal(cleanupSql.split(`-- ${CONFIRM_LINE}`).length, 2, 'una sola riga di conferma commentata');
const realCleanupSql = cleanupSql.replace(`-- ${CONFIRM_LINE}`, CONFIRM_LINE);
assert.ok(realCleanupSql.indexOf('\n' + CONFIRM_LINE) > realCleanupSql.indexOf('\nBEGIN;\n'), 'conferma dentro la transazione');
const SESSION_FLAG = "SELECT set_config('skibidi.cleanup_confirm', 'CANCELLA-16-ORDINI-VUOTI', false);";
const resultRow = (res) => res.find((r) => r.rows?.length && 'mode' in r.rows[0]).rows[0];

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

  assert.match(b.backup.sha256, /^[0-9a-f]{64}$/);
  ok('backup con checksum sha256');

  const dry = await exec(db, cleanupSql);
  assert.equal(dry.error, undefined, dry.error?.message);
  assert.deepEqual({ ...resultRow(dry.res) }, { mode: 'dry-run', deleted: 16, orders_total: 37, order_items_total: 42, empty_orders_total: 16 });
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  assert.deepEqual(await dump(db), before);
  const wrongFlag = await exec(db, "SELECT set_config('skibidi.cleanup_confirm', 'si', false);\n" + cleanupSql);
  assert.equal(resultRow(wrongFlag.res).mode, 'dry-run');
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  ok('dry-run predefinito: controlli e DELETE annullati (ROLLBACK), nulla cancellato; flag sbagliato = dry-run');

  const c = await exec(db, realCleanupSql);
  assert.equal(c.error, undefined, c.error?.message);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  assert.deepEqual({ ...resultRow(c.res) }, { mode: 'deleted', deleted: 16, orders_total: 21, order_items_total: 42, empty_orders_total: 0 });
  const flag = await one(db, "SELECT current_setting('skibidi.cleanup_confirm', true) AS f");
  assert.equal(flag.f, '', 'flag monouso azzerato');
  ok('pulizia con flag: cancellati 16, restano 21 ordini e 42 righe, nessun ordine vuoto; flag azzerato');

  const again = await exec(db, realCleanupSql);
  assert.match(String(again.error?.message), /CLEANUP_ABORT: attesi 16 ordini, trovati 0/);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('rieseguire la pulizia si annulla e non cambia nulla');

  const restoreSql = buildRestoreSql(restoreTemplate, JSON.stringify([b]));
  // sessione con un altro fuso: il ripristino lavora in UTC, checksum e date identici
  await db.exec("SET TimeZone = 'Europe/Rome'");
  const r = await exec(db, restoreSql);
  await db.exec('RESET TimeZone');
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

  const dry2 = await exec(db, cleanupSql);
  assert.equal(resultRow(dry2.res).mode, 'dry-run', 'senza flag di nuovo dry-run (flag monouso)');
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  const c2 = await exec(db, realCleanupSql);
  assert.equal(c2.error, undefined, c2.error?.message);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('pulizia di nuovo possibile dopo il ripristino (senza flag resta dry-run)');
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
  for (const sql of [cleanupSql, realCleanupSql]) {
    const res = await exec(db, sql);
    assert.match(String(res.error?.message), re, name);
    assert.deepEqual(await state(db), expectState, `${name}: nessuna riga cancellata`);
  }
  ok(`annulla se ${name} (dry-run e con flag)`);
}

// 3) Un nuovo ordine vuoto NON in lista non viene toccato: si cancellano solo i 16 id espliciti.
{
  const db = await fresh();
  await db.exec(`INSERT INTO orders (total_amount, company_id) VALUES (9, '00000000-0000-0000-0000-000000000001')`);
  const res = await exec(db, realCleanupSql);
  assert.equal(res.error, undefined, res.error?.message);
  assert.deepEqual(await state(db), { orders: 22, items: 42, empty: 1 });
  ok('cancella solo i 16 id della lista (un nuovo ordine vuoto resta)');
}

// 3b) Nessun flag di sessione (impostato prima, anche dopo una pulizia confermata annullata) fa cancellare.
{
  const db = await fresh();
  const flag = async () => (await one(db, "SELECT coalesce(current_setting('skibidi.cleanup_confirm', true), '<unset>') AS f")).f;
  // repro round22 (harness/stale38.mjs): flag di sessione in una chiamata separata, poi pulizia annullata
  await db.exec(SESSION_FLAG);
  await db.exec(`INSERT INTO order_items (order_id, unit_price) VALUES ('0d050c47-a5f1-456c-9aec-8e2b7ca9ced2', 5)`);
  const aborted = await exec(db, cleanupSql);
  assert.match(String(aborted.error?.message), /CLEANUP_ABORT: 1 order_items/);
  await db.exec(`DELETE FROM order_items WHERE order_id = '0d050c47-a5f1-456c-9aec-8e2b7ca9ced2'`);
  const plain = await exec(db, cleanupSql);
  assert.equal(resultRow(plain.res).mode, 'dry-run', 'flag di sessione rimasto: deve restare dry-run');
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  assert.equal(await flag(), '');
  // flag di sessione in una chiamata separata, subito prima: dry-run
  await db.exec(SESSION_FLAG);
  assert.equal(resultRow((await exec(db, cleanupSql)).res).mode, 'dry-run');
  // flag in testa allo stesso testo (anche locale): azzerato prima di BEGIN, dry-run
  assert.equal(resultRow((await exec(db, SESSION_FLAG + '\n' + cleanupSql)).res).mode, 'dry-run');
  assert.equal(resultRow((await exec(db, SESSION_FLAG.replace('false', 'true') + '\n' + cleanupSql)).res).mode, 'dry-run');
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  // pulizia CONFERMATA annullata: il flag locale sparisce, la successiva senza flag è dry-run
  await db.exec(`INSERT INTO order_no_shows (order_id) VALUES ('d7c6ef59-9d66-43ab-9860-f67b79f8fdbc')`);
  assert.match(String((await exec(db, realCleanupSql)).error?.message), /CLEANUP_ABORT/);
  assert.equal(await flag(), '');
  await db.exec(`DELETE FROM order_no_shows`);
  assert.equal(resultRow((await exec(db, cleanupSql)).res).mode, 'dry-run');
  assert.deepEqual(await state(db), { orders: 37, items: 42, empty: 16 });
  // e con la conferma locale si cancella davvero; dopo il COMMIT nessun flag in sessione
  assert.equal(resultRow((await exec(db, realCleanupSql)).res).mode, 'deleted');
  assert.equal(await flag(), '');
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('flag solo locale: un flag di sessione (anche rimasto dopo una pulizia annullata) non cancella mai; azzerato prima di BEGIN e dopo COMMIT');
}

// 4) Il ripristino rifiuta backup sbagliati.
{
  assert.throws(() => buildRestoreSql(restoreTemplate, '{"kind":"altro"}'), /Backup non valido/);
  assert.throws(() => buildRestoreSql(restoreTemplate, JSON.stringify({ kind: 'skibidi-cleanup-empty-orders-2026-10', orders: [] })), /attesi 16 ordini/);
  const db = await fresh();
  const b = await backup(db);
  const tampered = structuredClone(b.backup);
  tampered.orders[0].id = '11111111-1111-1111-1111-111111111111';
  await exec(db, realCleanupSql);
  const res = await exec(db, buildRestoreSql(restoreTemplate, tampered));
  assert.match(String(res.error?.message), /RESTORE_ABORT: checksum sha256/);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  // totale modificato a mano: rifiutato (prima veniva ripristinato così com'era)
  const edited = structuredClone(b.backup);
  edited.orders.find((o) => o.id === 'd7c6ef59-9d66-43ab-9860-f67b79f8fdbc').total_amount = 8.5;
  const resEdited = await exec(db, buildRestoreSql(restoreTemplate, edited));
  assert.match(String(resEdited.error?.message), /RESTORE_ABORT: checksum sha256/);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  // id manomesso con checksum ricalcolato: resta il controllo dei 16 id
  await db.exec("SET TimeZone = 'UTC'");
  const forgedSha = (await db.query(`SELECT encode(sha256(convert_to((($1::jsonb - 'sha256' - 'orders') || jsonb_build_object('orders',
      (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) FROM jsonb_populate_recordset(NULL::public.orders, $1::jsonb->'orders') r)))::text, 'UTF8')), 'hex') AS h`,
    [JSON.stringify(tampered)])).rows[0].h;
  await db.exec('RESET TimeZone');
  const resForged = await exec(db, buildRestoreSql(restoreTemplate, { ...tampered, sha256: forgedSha }));
  assert.match(String(resForged.error?.message), /RESTORE_ABORT: il backup non contiene esattamente i 16 ordini attesi/);
  // backup senza checksum: rifiutato già dal generatore
  const noSha = structuredClone(b.backup);
  delete noSha.sha256;
  assert.throws(() => buildRestoreSql(restoreTemplate, noSha), /checksum sha256/);
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  const unfilled = await exec(db, restoreTemplate);
  assert.ok(unfilled.error, 'il template senza backup non si può eseguire');
  assert.deepEqual(await state(db), { orders: 21, items: 42, empty: 0 });
  ok('ripristino: rifiuta backup estranei/manomessi (checksum sha256, id), senza checksum e il template non compilato');
}

console.log(`ALL PASS (${passed})`);
