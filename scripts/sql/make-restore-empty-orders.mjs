#!/usr/bin/env node
// Crea lo script di ripristino pronto da eseguire a partire dal backup JSON.
// Uso: node scripts/sql/make-restore-empty-orders.mjs <backup.json> > restore-filled.sql
// <backup.json> = la colonna `backup` restituita da cleanup-empty-orders-2026-10-backup.sql
// (accetta anche l'array di righe restituito da execute_sql: [{ ..., "backup": {...} }]).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function buildRestoreSql(template, backupInput) {
  let doc = typeof backupInput === 'string' ? JSON.parse(backupInput) : backupInput;
  if (Array.isArray(doc)) doc = doc[0];
  if (doc && doc.backup && !doc.kind) doc = doc.backup;
  if (typeof doc === 'string') doc = JSON.parse(doc);
  if (!doc || doc.kind !== 'skibidi-cleanup-empty-orders-2026-10') {
    throw new Error('Backup non valido: manca kind=skibidi-cleanup-empty-orders-2026-10');
  }
  if (!Array.isArray(doc.orders) || doc.orders.length !== 16) {
    throw new Error(`Backup non valido: attesi 16 ordini, trovati ${doc.orders?.length ?? 0}`);
  }
  const json = JSON.stringify(doc);
  if (json.includes('$backup$')) throw new Error('Il backup contiene il delimitatore $backup$');
  if (!template.includes('__BACKUP_JSON__')) throw new Error('Template senza __BACKUP_JSON__');
  return template.split('$backup$__BACKUP_JSON__$backup$').join(`$backup$${json}$backup$`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node scripts/sql/make-restore-empty-orders.mjs <backup.json>');
    process.exit(2);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(path.join(here, 'cleanup-empty-orders-2026-10-restore.sql'), 'utf8');
  process.stdout.write(buildRestoreSql(template, fs.readFileSync(file, 'utf8')));
}
