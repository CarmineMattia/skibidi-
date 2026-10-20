#!/usr/bin/env node
/**
 * Controlla che ogni prodotto attivo abbia un'immagine funzionante.
 *
 * Input: file JSON con i prodotti (export in sola lettura, es.
 *   select p.id, p.name, p.description, p.image_url, c.name as category
 *   from products p left join categories c on c.id = p.category_id where p.active;
 * ). Lo script NON si collega al database.
 *
 * Immagine effettiva = foto locale di lib/data/pizzaPhotos.ts (stesso id e stessa
 * ricetta), altrimenti products.image_url (controllata via HTTP: 200 + image/*).
 *
 * Uso: node scripts/check-product-images.mjs products.json
 */
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/check-product-images.mjs products.json');
  process.exit(2);
}
const products = JSON.parse(fs.readFileSync(file, 'utf-8'));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'lib/data/pizzaPhotos.ts'), 'utf-8');
const photos = new Map();
for (const m of src.matchAll(/"([0-9a-f-]{36})": \{ name: "[^"]*", category: "[^"]*", recipe: "([^"]*)", asset: require\("\.\.\/\.\.\/(assets\/[^"]+)"\)/g)) {
  photos.set(m[1], { recipe: m[2], asset: m[3] });
}
const norm = (s) => (s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

async function checkUrl(url) {
  if (!url) return 'nessuna immagine';
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    return res.ok && type.startsWith('image/') ? 'ok' : `HTTP ${res.status} ${type}`;
  } catch (e) {
    return `errore: ${e.message}`;
  }
}

const problems = [];
for (const p of products) {
  const photo = photos.get(p.id);
  let status;
  if (photo && norm(photo.recipe) === norm(p.description)) {
    status = fs.existsSync(path.join(root, photo.asset)) ? 'ok' : `asset mancante ${photo.asset}`;
  } else {
    status = await checkUrl(p.image_url);
    if (photo && status !== 'ok') status += ' (foto locale ignorata: ricetta diversa)';
  }
  if (status !== 'ok') problems.push({ category: p.category, name: p.name, status, image_url: p.image_url });
}
console.log(`${products.length} prodotti, ${problems.length} senza immagine funzionante`);
for (const x of problems) console.log(`- [${x.category}] ${x.name}: ${x.status}${x.image_url ? ` (${x.image_url})` : ''}`);
process.exit(problems.length ? 1 : 0);
