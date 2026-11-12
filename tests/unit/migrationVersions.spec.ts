/**
 * Storia delle migration: ogni file in supabase/migrations deve avere una versione
 * (il prefisso numerico) unica. La CLI di Supabase usa la versione come chiave
 * (`schema_migrations.version`): due file con la stessa versione fanno fallire `db push`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = path.resolve(__dirname, '../../supabase/migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parsed = files.map((f) => ({ file: f, match: /^(\d+)_(.+)\.sql$/.exec(f) }));

describe('supabase/migrations', () => {
  it('ogni file è <versione>_<nome>.sql', () => {
    expect(parsed.filter((p) => !p.match).map((p) => p.file)).toEqual([]);
  });

  it('le versioni sono uniche', () => {
    const byVersion = new Map<string, string[]>();
    for (const p of parsed) {
      if (!p.match) continue;
      byVersion.set(p.match[1], [...(byVersion.get(p.match[1]) ?? []), p.file]);
    }
    const dupes = [...byVersion.entries()].filter(([, fs]) => fs.length > 1);
    expect(dupes).toEqual([]);
  });

  it('le 6 migration presenti solo su prod sono nel repo', () => {
    for (const v of ['20260117194108', '20260724140614', '20260724143416', '20260724152401', '20260901223534', '20260901224024']) {
      expect(files.some((f) => f.startsWith(`${v}_`)), v).toBe(true);
    }
  });

  it('le migration con dipendenze restano nell’ordine giusto', () => {
    // Due ordinamenti possibili: per nome file (come legge la CLI) e per versione numerica.
    // Devono dare lo stesso risultato: un prefisso a 8 cifre ("20260901_") ordina dopo i
    // file a 14 cifre dello stesso giorno ("20260901223534_") per nome, prima per versione.
    const byVersion = [...files].sort((a, b) => (/^(\d+)_/.exec(a)![1] < /^(\d+)_/.exec(b)![1] ? -1 : 1));
    for (const list of [files, byVersion]) checkOrder((prefix) => list.findIndex((f) => f.startsWith(prefix)));
  });
});

function checkOrder(order: (prefix: string) => number) {
  expect(order('20260711000000_order_display_code')).toBeLessThan(order('20261012234356_enable_rls_order_daily_counters')); // crea order_daily_counters
  expect(order('20261013000100_order_status_manual_approval_enum')).toBeLessThan(order('20261013000200_order_manual_approval_guard'));
  expect(order('20261013000200_order_manual_approval_guard')).toBeLessThan(order('20261013140000_order_antiabuse'));
  expect(order('20260210152523_fiscal_tables')).toBeLessThan(order('20260210152537_performance_indexes'));
  expect(order('20260901000000_fix_guest_order_items_rls')).toBeLessThan(order('20260901223534_fix_can_insert_order_item_guest_scope'));
  expect(order('20260901223534_fix_can_insert_order_item_guest_scope')).toBeLessThan(order('20260901224024_fix_can_insert_order_item_column'));
  expect(order('20260901224024_fix_can_insert_order_item_column')).toBeLessThan(order('20261020140000_order_items_insert_guard'));
  // 20261111234500 ricrea get_order_tracking. Va prima di 20261112030000, che ci aggiunge points_*.
  expect(order('20261111234500')).toBeLessThan(order('20261112003000'));
  expect(order('20261112003000')).toBeLessThan(order('20261112010000'));
  expect(order('20261112010000')).toBeLessThan(order('20261112020000'));
  expect(order('20261112020000')).toBeLessThan(order('20261112030000'));
  expect(order('20261112030000')).toBeLessThan(order('20261112040000'));
}
