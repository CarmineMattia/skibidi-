/**
 * Cart calculation utilities tests
 */

import type { Product } from '@/types';

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

/**
 * Calculate total items in cart
 */
function calculateTotalItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Calculate total amount in cents
 */
function calculateTotalAmount(items: CartItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * 100
  );
}

/**
 * Calculate VAT (22% for food)
 */
function calculateVAT(totalAmountCents: number): number {
  return Math.round(totalAmountCents * 0.22);
}

/**
 * Calculate total including VAT
 */
function calculateTotalWithVAT(totalAmountCents: number): number {
  return totalAmountCents + calculateVAT(totalAmountCents);
}

const mockProduct: Product = {
  id: '1',
  name: 'Pizza Margherita',
  price: 8.50,
  description: 'Classic tomato and mozzarella',
  image_url: null,
  category_id: 'cat1',
  active: true,
  display_order: 1,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

describe('Cart calculations', () => {
  describe('calculateTotalItems', () => {
    it('returns 0 for empty cart', () => {
      expect(calculateTotalItems([])).toBe(0);
    });

    it('calculates total items correctly', () => {
      const items: CartItem[] = [
        { product: mockProduct, quantity: 2 },
        { product: { ...mockProduct, id: '2' }, quantity: 3 },
      ];
      expect(calculateTotalItems(items)).toBe(5);
    });
  });

  describe('calculateTotalAmount', () => {
    it('returns 0 for empty cart', () => {
      expect(calculateTotalAmount([])).toBe(0);
    });

    it('calculates total in cents correctly', () => {
      const items: CartItem[] = [
        { product: mockProduct, quantity: 1 }, // 8.50 € = 850 cents
      ];
      expect(calculateTotalAmount(items)).toBe(850);
    });

    it('handles multiple quantities', () => {
      const items: CartItem[] = [
        { product: mockProduct, quantity: 2 }, // 2 * 8.50 = 17.00 € = 1700 cents
      ];
      expect(calculateTotalAmount(items)).toBe(1700);
    });
  });

  describe('calculateVAT', () => {
    it('calculates 22% VAT correctly', () => {
      expect(calculateVAT(1000)).toBe(220); // 10€ * 22% = 2.20€
    });

    it('rounds to nearest integer', () => {
      expect(calculateVAT(1001)).toBe(220); // 10.01€ * 22% = 2.2022€ → 220 cents
    });
  });

  describe('calculateTotalWithVAT', () => {
    it('adds VAT to total', () => {
      expect(calculateTotalWithVAT(1000)).toBe(1220); // 10€ + 2.20€ VAT
    });
  });
});
