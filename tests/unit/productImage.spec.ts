import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStoredImageUrl, imageUrlToPersist, isStorageImageUrl, resolveProductImage } from '../../lib/utils/productImage';

const STORAGE = 'https://zqubwvhstobaugifzoyb.supabase.co/storage/v1/object/public/products/ambrosia/margherita.jpg';
const UNSPLASH = 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=800';
const BUNDLED = { recipe: 'pomodoro, mozz.fior di latte', uri: '/assets/assets/images/products/margherita-generated-v1.webp' };
const margherita: { id: string; name: string; description: string; image_url?: string } = { id: 'm', name: 'Margherita', description: 'pomodoro, mozz.fior di latte' };

describe('isStorageImageUrl', () => {
  it.each([
    [STORAGE, true],
    ['https://other.supabase.co/storage/v1/object/public/products/x.jpg', true],
    ['https://zqubwvhstobaugifzoyb.supabase.co/storage/v1/object/public/', false],
    ['https://zqubwvhstobaugifzoyb.supabase.co/storage/v1/object/sign/products/x.jpg?token=t', false],
    ['http://zqubwvhstobaugifzoyb.supabase.co/storage/v1/object/public/products/x.jpg', false],
    ['https://evil.example/storage/v1/object/public/products/x.jpg', false],
    ['https://supabase.co.evil.example/storage/v1/object/public/x.jpg', false],
    [UNSPLASH, false],
    ['/assets/assets/images/products/margherita-generated-v1.webp', false],
    ['', false],
    [null, false],
    ['not a url', false],
  ])('%s -> %s', (url, expected) => {
    expect(isStorageImageUrl(url, '')).toBe(expected);
  });

  it('accepts the configured project URL (local / custom domain)', () => {
    expect(isStorageImageUrl('http://127.0.0.1:54321/storage/v1/object/public/products/x.jpg', 'http://127.0.0.1:54321')).toBe(true);
    expect(isStorageImageUrl('http://127.0.0.1:9999/storage/v1/object/public/products/x.jpg', 'http://127.0.0.1:54321')).toBe(false);
  });
});

describe('resolveProductImage', () => {
  it('a Supabase Storage photo wins over the bundled photo (the 4 real photos)', () => {
    const out = resolveProductImage({ ...margherita, image_url: STORAGE }, BUNDLED, '');
    expect(out.image_url).toBe(STORAGE);
    expect(out.stored_image_url).toBe(STORAGE);
  });

  it('bundled photo when there is no image_url (same recipe), DB value kept aside', () => {
    const out = resolveProductImage({ ...margherita, image_url: undefined }, BUNDLED, '');
    expect(out.image_url).toBe(BUNDLED.uri);
    expect(out.stored_image_url).toBeNull();
  });

  it('bundled photo also beats a non-Storage URL (legacy / stock seed on a pizza)', () => {
    const out = resolveProductImage({ ...margherita, image_url: UNSPLASH }, BUNDLED, '');
    expect(out.image_url).toBe(BUNDLED.uri);
    expect(out.stored_image_url).toBe(UNSPLASH);
  });

  it('no bundled photo when the recipe changed', () => {
    const product = { ...margherita, description: 'pomodoro, bufala', image_url: undefined };
    expect(resolveProductImage(product, BUNDLED, '')).toBe(product);
  });

  it('recipe match ignores case, spaces and Unicode form', () => {
    const out = resolveProductImage({ ...margherita, description: '  Pomodoro,   MOZZ.fior di latte ' }, BUNDLED, '');
    expect(out.image_url).toBe(BUNDLED.uri);
  });

  it('drinks (no bundled photo): Unsplash image_url unchanged, same object', () => {
    const drink = { id: 'd', name: 'Coca Cola', description: '', image_url: UNSPLASH };
    expect(resolveProductImage(drink, undefined, '')).toBe(drink);
  });

  it('products without any image keep the placeholder (no image_url)', () => {
    const dessert = { id: 't', name: 'Tiramisù', description: null, image_url: undefined };
    const out = resolveProductImage(dessert, undefined, '');
    expect(out.image_url).toBeUndefined();
  });

  it('is idempotent (cart items are resolved again from storage)', () => {
    const once = resolveProductImage({ ...margherita, image_url: undefined }, BUNDLED, '');
    expect(resolveProductImage(once, BUNDLED, '')).toEqual(once);
    const storage = resolveProductImage({ ...margherita, image_url: STORAGE }, BUNDLED, '');
    expect(resolveProductImage(storage, BUNDLED, '')).toEqual(storage);
  });

  it('a product resolved before a Storage photo existed picks it up from stored_image_url', () => {
    const old = { ...margherita, image_url: BUNDLED.uri, stored_image_url: STORAGE };
    expect(resolveProductImage(old, BUNDLED, '').image_url).toBe(STORAGE);
  });

  it('resolved product whose bundled photo is gone falls back to the DB value', () => {
    const resolved = { ...margherita, image_url: BUNDLED.uri, stored_image_url: null };
    expect(resolveProductImage(resolved, undefined, '').image_url).toBeUndefined();
  });
});

describe('getStoredImageUrl / imageUrlToPersist (admin editor)', () => {
  it('reads the DB value from raw and resolved products', () => {
    expect(getStoredImageUrl({ image_url: ' ' })).toBeNull();
    expect(getStoredImageUrl({ image_url: UNSPLASH })).toBe(UNSPLASH);
    expect(getStoredImageUrl({ image_url: BUNDLED.uri, stored_image_url: null })).toBeNull();
  });

  it('an untouched bundled photo saves the DB value, never the asset uri', () => {
    const resolved = resolveProductImage({ ...margherita, image_url: undefined }, BUNDLED, '');
    expect(imageUrlToPersist(resolved.image_url, resolved)).toBeNull();
    const withStock = resolveProductImage({ ...margherita, image_url: UNSPLASH }, BUNDLED, '');
    expect(imageUrlToPersist(withStock.image_url, withStock)).toBe(UNSPLASH);
  });

  it('a new upload or a cleared image is saved as edited', () => {
    const resolved = resolveProductImage({ ...margherita, image_url: undefined }, BUNDLED, '');
    expect(imageUrlToPersist(STORAGE, resolved)).toBe(STORAGE);
    expect(imageUrlToPersist(null, resolved)).toBeNull();
    expect(imageUrlToPersist('', { image_url: UNSPLASH })).toBeNull();
    expect(imageUrlToPersist(UNSPLASH, { image_url: UNSPLASH })).toBe(UNSPLASH);
    expect(imageUrlToPersist(STORAGE, null)).toBe(STORAGE);
  });
});

// Live state (read-only export of the 85 active products, 2026-10-21) against the
// bundled photo map in lib/data/pizzaPhotos.ts (parsed as text: the module needs expo-asset).
describe('Ambrosia live catalogue', () => {
  const root = path.resolve(__dirname, '../..');
  const { products } = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/ambrosia-product-images.json'), 'utf8')) as {
    products: { id: string; name: string; category: string; description: string | null; image_url: string | null }[];
  };
  const source = fs.readFileSync(path.join(root, 'lib/data/pizzaPhotos.ts'), 'utf8');
  const bundled = new Map<string, { recipe: string; uri: string }>();
  for (const m of source.matchAll(/"([0-9a-f-]{36})": \{ name: "[^"]*", category: "[^"]*", recipe: "([^"]*)", asset: require\("([^"]+)"\)/g)) {
    bundled.set(m[1], { recipe: m[2], uri: m[3] });
  }
  const resolved = products.map((p) => ({ p, out: resolveProductImage({ ...p, image_url: p.image_url ?? undefined }, bundled.get(p.id), '') }));
  const kind = (u?: string | null) => (!u ? 'none' : isStorageImageUrl(u, '') ? 'storage' : u.includes('generated') ? 'bundled' : 'url');

  it('85 active products, 48 bundled photos', () => {
    expect(products).toHaveLength(85);
    expect(bundled.size).toBe(48);
  });

  it('the 4 real Storage photos now show (were hidden by the bundled ones)', () => {
    const storage = resolved.filter(({ out }) => kind(out.image_url) === 'storage').map(({ p }) => p.name).sort();
    expect(storage).toEqual(['Crudo e Burrata', 'Funghi', 'Margherita', 'Speciale']);
    for (const name of storage) expect(bundled.has(products.find((p) => p.name === name)!.id)).toBe(true);
  });

  it('the 26 drinks keep their Unsplash image_url, unchanged', () => {
    const drinks = resolved.filter(({ p }) => p.category === 'Bevande');
    expect(drinks).toHaveLength(26);
    for (const { p, out } of drinks) {
      expect(bundled.has(p.id)).toBe(false);
      expect(out.image_url).toBe(p.image_url);
      expect(kind(out.image_url)).toBe('url');
    }
  });

  it('44 keep the bundled photo and 11 have no image (placeholder)', () => {
    expect(resolved.filter(({ out }) => kind(out.image_url) === 'bundled')).toHaveLength(44);
    const none = resolved.filter(({ out }) => kind(out.image_url) === 'none').map(({ p }) => `${p.category}: ${p.name}`).sort();
    expect(none).toEqual([
      'Al metro: Farcita', 'Al metro: Gourmet', 'Al metro: Margherita', 'Al metro: Metà Margherita Metà Farcita', 'Al metro: Super Farcita',
      'Bianche: Stria',
      'Dolci: Profiterol', 'Dolci: Sorbetto al Limone', 'Dolci: Tartufo Bianco / Nero', 'Dolci: Tiramisù', 'Dolci: Torroncino',
    ]);
  });

  it('only the 4 Storage products change compared with before', () => {
    const before = (p: (typeof products)[number]) => {
      const b = bundled.get(p.id);
      return b && (p.description ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim() === b.recipe.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
        ? b.uri : p.image_url ?? undefined;
    };
    const changed = resolved.filter(({ p, out }) => out.image_url !== before(p)).map(({ p }) => p.name).sort();
    expect(changed).toEqual(['Crudo e Burrata', 'Funghi', 'Margherita', 'Speciale']);
  });
});
