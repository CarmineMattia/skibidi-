/**
 * Test Fixtures
 * Shared test data and utilities for SKIBIDI ORDERS tests
 */

export interface TestProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  active: boolean;
}

export interface TestCategory {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface TestUser {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'customer' | 'kiosk';
}

// Sample product data matching the database
export const TEST_PRODUCTS: TestProduct[] = [
  {
    id: 'test-product-1',
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato and mozzarella',
    price: 1200, // €12.00
    category_id: 'test-category-1',
    active: true,
  },
  {
    id: 'test-product-2',
    name: 'Spaghetti Carbonara',
    description: 'Pasta with eggs, bacon, and parmesan',
    price: 1400, // €14.00
    category_id: 'test-category-1',
    active: true,
  },
  {
    id: 'test-product-3',
    name: 'Tiramisu',
    description: 'Classic Italian dessert',
    price: 800, // €8.00
    category_id: 'test-category-2',
    active: true,
  },
];

export const TEST_CATEGORIES: TestCategory[] = [
  {
    id: 'test-category-1',
    name: 'Primi Piatti',
    description: 'Main courses',
    active: true,
  },
  {
    id: 'test-category-2',
    name: 'Dolci',
    description: 'Desserts',
    active: true,
  },
];

// E2E-only test credentials – never use in production
export const TEST_USERS: Record<'admin' | 'customer', TestUser> = {
  admin: {
    email: 'admin@test.com',
    password: 'testpassword123',
    full_name: 'Test Admin',
    role: 'admin',
  },
  customer: {
    email: 'customer@test.com',
    password: 'testpassword123',
    full_name: 'Test Customer',
    role: 'customer',
  },
};

// Helper function to format price in cents to display format
export function formatPrice(priceInCents: number): string {
  return `€${(priceInCents / 100).toFixed(2)}`;
}

// Helper to calculate cart total
export function calculateCartTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

// Generate unique test email
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  return `${prefix}+${timestamp}@test.com`;
}