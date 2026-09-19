/**
 * Cart Context
 * Stato carrello client-side, persistito su localStorage (web) così
 * indietro/refresh non svuotano l'ordine.
 */

import type { Product } from '@/types';
import { readJsonStorage, writeJsonStorage } from '@/lib/utils/storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  modifiers?: string[];
  unitPriceOverride?: number;
}

export function getCartItemUnitPrice(item: CartItem): number {
  return item.unitPriceOverride ?? item.product.price;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product,
    quantity?: number,
    notes?: string,
    modifiers?: string[],
    unitPriceOverride?: number
  ) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | null>(null);
const CART_STORAGE_KEY = 'ambrosia.cart.v1';

function loadInitialCart(): CartItem[] {
  const saved = readJsonStorage<CartItem[]>(CART_STORAGE_KEY, 'local');
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (item) =>
      item &&
      item.product &&
      typeof item.product.id === 'string' &&
      typeof item.product.name === 'string' &&
      typeof item.product.price === 'number' &&
      Number.isFinite(item.product.price) && item.product.price >= 0 &&
      (item.unitPriceOverride == null || (typeof item.unitPriceOverride === 'number' &&
        Number.isFinite(item.unitPriceOverride) && item.unitPriceOverride >= 0)) &&
      (item.notes == null || typeof item.notes === 'string') &&
      (item.modifiers == null || (Array.isArray(item.modifiers) &&
        item.modifiers.every((modifier) => typeof modifier === 'string'))) &&
      typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity) &&
      item.quantity > 0
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadInitialCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJsonStorage(CART_STORAGE_KEY, items, 'local');
  }, [items, hydrated]);

  const addItem = useCallback(
    (
      product: Product,
      quantity: number = 1,
      notes: string = '',
      modifiers: string[] = [],
      unitPriceOverride?: number
    ) => {
      setItems((current) => {
        const existingIndex = current.findIndex(
          (item) =>
            item.product.id === product.id &&
            (item.notes || '') === notes &&
            JSON.stringify(item.modifiers || []) === JSON.stringify(modifiers) &&
            (item.unitPriceOverride ?? null) === (unitPriceOverride ?? null)
        );

        if (existingIndex !== -1) {
          const updated = [...current];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          return updated;
        }

        return [...current, { product, quantity, notes, modifiers, unitPriceOverride }];
      });
    },
    []
  );

  const removeItem = useCallback((index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback(
    (index: number, quantity: number) => {
      if (quantity <= 0) {
        removeItem(index);
        return;
      }

      setItems((current) =>
        current.map((item, i) => (i === index ? { ...item, quantity } : item))
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + getCartItemUnitPrice(item) * item.quantity,
    0
  );

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalAmount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
