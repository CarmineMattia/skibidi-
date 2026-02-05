/**
 * Cart Context
 * Gestisce lo stato del carrello locale (client-side)
 */

import type { Product } from '@/types';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  modifiers?: string[]; // Array of selected ingredient modifications
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, notes?: string, modifiers?: string[]) => void;
  removeItem: (index: number) => void; // Changed to index because multiple items can have same productId
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Product, quantity: number = 1, notes: string = '', modifiers: string[] = []) => {
    setItems((current) => {
      // Check if exact same item exists (same product, same notes, same modifiers)
      const existingIndex = current.findIndex((item) =>
        item.product.id === product.id &&
        (item.notes || '') === notes &&
        JSON.stringify(item.modifiers || []) === JSON.stringify(modifiers)
      );

      if (existingIndex !== -1) {
        // Exact item exists, update quantity
        const updated = [...current];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      // Add new item
      return [...current, { product, quantity, notes, modifiers }];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Calculated values
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
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
