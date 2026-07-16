/**
 * Combo / offerte — definizioni statiche risolte dinamicamente sui prodotti del menu.
 */

import type { Product } from '@/types';

export interface ComboOfferDefinition {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  includes: string[];
  /** Nomi (o substring) prodotti da cercare nel menu */
  productMatchers: string[];
  fallbackImageUrl: string;
  /** Sconto percentuale sul totale prodotti (0–1) */
  discount?: number;
}

export interface ResolvedComboOffer {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  includes: string[];
  imageUrl: string;
  previewImages: string[];
  price: number;
  originalPrice: number;
  products: Product[];
}

const PIZZA_FALLBACK =
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80';
const DRINK_FALLBACK =
  'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=400&q=80';
const ANTIPASTO_FALLBACK =
  'https://images.unsplash.com/photo-1572441713132-51b4c812c89e?auto=format&fit=crop&w=400&q=80';
const DESSERT_FALLBACK =
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80';

export const COMBO_OFFERS: ComboOfferDefinition[] = [
  {
    id: 'combo-pizza-drink',
    title: 'Pizza + Drink',
    subtitle: 'Una pizza a scelta con bibita 33cl inclusa',
    cta: 'Aggiungi combo',
    includes: ['Pizza', 'Drink'],
    productMatchers: ['Margherita', 'Coca Cola'],
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?auto=format&fit=crop&w=1200&q=80',
    discount: 0.1,
  },
  {
    id: 'combo-duo-pizza',
    title: 'Duo Pizza',
    subtitle: 'Due pizze classiche da condividere, prezzo speciale',
    cta: 'Prendi il duo',
    includes: ['2x Pizza'],
    productMatchers: ['Margherita', 'Diavola'],
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80',
    discount: 0.12,
  },
  {
    id: 'combo-family',
    title: 'Family Combo',
    subtitle: '2 pizze, antipasto e 2 bibite per tutta la famiglia',
    cta: 'Ordina family',
    includes: ['2x Pizza', 'Antipasto', '2x Drink'],
    productMatchers: ['Capricciosa', 'Bufalina', 'Bruschetta', 'Coca Cola'],
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=80',
    discount: 0.15,
  },
  {
    id: 'combo-pranzo',
    title: 'Pranzo Smart',
    subtitle: 'Pizza + acqua — perfetto per la pausa pranzo',
    cta: 'Attiva pranzo',
    includes: ['Pizza', 'Acqua'],
    productMatchers: ['Marinara', 'Acqua Naturale'],
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1594007654729-407eedc4fe0f?auto=format&fit=crop&w=1200&q=80',
    discount: 0.08,
  },
  {
    id: 'combo-dolce',
    title: 'Pizza & Dolce',
    subtitle: 'Pizza gourmet e dessert fatto in casa',
    cta: 'Scopri combo',
    includes: ['Pizza', 'Dolce'],
    productMatchers: ['Truffle', 'Tiramisù'],
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1542834369-f10ebf06d3e0?auto=format&fit=crop&w=1200&q=80',
    discount: 0.1,
  },
  {
    id: 'combo-serata',
    title: 'Serata Birra',
    subtitle: 'Pizza speciale e birra artigianale inclusa',
    cta: 'Inizia serata',
    includes: ['Pizza', 'Birra'],
    productMatchers: ['Carbonara', 'Birra Moretti'],
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
    discount: 0.1,
  },
];

function productFallbackImage(product: Product): string {
  const name = `${product.name} ${product.description ?? ''}`.toLowerCase();
  if (name.includes('birra') || name.includes('coca') || name.includes('acqua') || name.includes('succhi') || name.includes('vino')) {
    return DRINK_FALLBACK;
  }
  if (name.includes('tiramis') || name.includes('cannolo') || name.includes('delizia') || name.includes('dolce')) {
    return DESSERT_FALLBACK;
  }
  if (name.includes('bruschetta') || name.includes('tagliere') || name.includes('frittatina')) {
    return ANTIPASTO_FALLBACK;
  }
  return PIZZA_FALLBACK;
}

export function getProductImageUrl(product: Product): string {
  return product.image_url?.trim() || productFallbackImage(product);
}

function findProductByMatcher(products: Product[], matcher: string): Product | undefined {
  const needle = matcher.toLowerCase();
  return products.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()));
}

export function resolveComboOffers(products: Product[]): ResolvedComboOffer[] {
  if (products.length === 0) {
    return COMBO_OFFERS.map((def) => ({
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      cta: def.cta,
      includes: def.includes,
      imageUrl: def.fallbackImageUrl,
      previewImages: [],
      price: 0,
      originalPrice: 0,
      products: [],
    }));
  }

  return COMBO_OFFERS.map((def) => {
    const matched = def.productMatchers
      .map((matcher) => findProductByMatcher(products, matcher))
      .filter((p): p is Product => Boolean(p));

    const uniqueProducts = matched.filter(
      (product, index, list) => list.findIndex((item) => item.id === product.id) === index
    );

    const previewImages = uniqueProducts.map(getProductImageUrl);
    const heroFromProduct = previewImages[0];
    const originalPrice = uniqueProducts.reduce((sum, p) => sum + p.price, 0);
    const discount = def.discount ?? 0;
    const price = originalPrice > 0 ? Math.round(originalPrice * (1 - discount) * 100) / 100 : 0;

    return {
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      cta: def.cta,
      includes: def.includes,
      imageUrl: heroFromProduct || def.fallbackImageUrl,
      previewImages,
      price,
      originalPrice,
      products: uniqueProducts,
    };
  });
}
