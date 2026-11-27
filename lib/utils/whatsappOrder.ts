import type { CartItem } from '@/lib/stores/CartContext';
import { getMaxGustiForProduct } from '@/lib/utils/menuCategories';
import { readJsonStorage, removeStorageKey, writeJsonStorage } from '@/lib/utils/storage';
import type { Category, Product } from '@/types';

const RETURN_KEY = 'ambrosia.whatsappOrderReturn.v1';
const RETURN_TTL_MS = 30 * 60 * 1000;
const LINE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([1-9][0-9]?)$/i;

type OrderLine = { productId: string; quantity: number };

export function parseWhatsAppOrder(value: unknown): OrderLine[] | null {
  if (typeof value !== 'string' || value.length > 480) return null;
  const parts = value.split(',');
  if (parts.length > 12) return null;

  const lines = new Map<string, OrderLine>();
  for (const part of parts) {
    const match = LINE_PATTERN.exec(part);
    if (!match || match[0] !== part) return null;
    const productId = match[1].toLowerCase();
    if (lines.has(productId)) return null;
    lines.set(productId, { productId, quantity: Number(match[2]) });
  }
  return [...lines.values()];
}

export function resolveWhatsAppOrder(
  lines: OrderLine[],
  products: Product[],
  categories: Category[]
): CartItem[] | null {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const categoriesById = new Map(categories.map((category) => [category.id, category.name]));
  const items: CartItem[] = [];

  for (const { productId, quantity } of lines) {
    const product = productsById.get(productId);
    if (!product?.active || !Number.isFinite(product.price) || product.price <= 0) return null;
    const categoryName = product.category_id ? categoriesById.get(product.category_id) : undefined;
    if (!categoryName || getMaxGustiForProduct(product.name, categoryName) > 0) return null;
    items.push({ product, quantity });
  }
  return items;
}

export function rememberWhatsAppOrder(lines: string) {
  writeJsonStorage(RETURN_KEY, { lines, expiresAt: Date.now() + RETURN_TTL_MS }, 'session');
}

export function consumeWhatsAppOrder(): string | null {
  const pending = readJsonStorage<{ lines: string; expiresAt: number }>(RETURN_KEY, 'session');
  removeStorageKey(RETURN_KEY, 'session');
  if (!pending || !Number.isFinite(pending.expiresAt)
      || pending.expiresAt <= Date.now() || !parseWhatsAppOrder(pending.lines)) return null;
  return pending.lines;
}
