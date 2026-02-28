/**
 * Unit Tests: Validation Utilities
 * Tests for validation functions used in the POS system
 */

import { test, expect, describe } from 'vitest';
import { formatPrice, calculateCartTotal } from '../fixtures/test-data';

describe('Price Formatting', () => {
  test('should format price in cents to display format', () => {
    expect(formatPrice(1000)).toBe('€10.00');
    expect(formatPrice(1200)).toBe('€12.00');
    expect(formatPrice(850)).toBe('€8.50');
    expect(formatPrice(0)).toBe('€0.00');
  });

  test('should handle decimal prices correctly', () => {
    expect(formatPrice(1050)).toBe('€10.50');
    expect(formatPrice(999)).toBe('€9.99');
  });

  test('should handle large prices', () => {
    expect(formatPrice(10000)).toBe('€100.00');
    expect(formatPrice(99999)).toBe('€999.99');
  });
});

describe('Cart Total Calculation', () => {
  test('should calculate empty cart total', () => {
    expect(calculateCartTotal([])).toBe(0);
  });

  test('should calculate single item total', () => {
    const items = [{ price: 1000, quantity: 2 }];
    expect(calculateCartTotal(items)).toBe(2000);
  });

  test('should calculate multiple items total', () => {
    const items = [
      { price: 1000, quantity: 2 }, // 20.00
      { price: 500, quantity: 3 },  // 15.00
      { price: 250, quantity: 1 },  // 2.50
    ];
    expect(calculateCartTotal(items)).toBe(3750);
  });

  test('should handle quantity of zero', () => {
    const items = [
      { price: 1000, quantity: 2 },
      { price: 500, quantity: 0 },
    ];
    expect(calculateCartTotal(items)).toBe(2000);
  });
});

describe('Email Validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  test('should validate correct email format', () => {
    expect(emailRegex.test('test@example.com')).toBe(true);
    expect(emailRegex.test('user.name@domain.org')).toBe(true);
    expect(emailRegex.test('user+tag@example.co.uk')).toBe(true);
  });

  test('should reject invalid email format', () => {
    expect(emailRegex.test('invalid')).toBe(false);
    expect(emailRegex.test('invalid@')).toBe(false);
    expect(emailRegex.test('@domain.com')).toBe(false);
    expect(emailRegex.test('test@')).toBe(false);
    expect(emailRegex.test('')).toBe(false);
  });
});

describe('Password Validation', () => {
  const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    return { valid: true, message: '' };
  };

  test('should accept valid passwords', () => {
    const result = validatePassword('password123');
    expect(result.valid).toBe(true);
  });

  test('should reject passwords shorter than 6 characters', () => {
    const result = validatePassword('12345');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('6');
  });

  test('should accept empty password as invalid', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
  });
});

describe('Phone Validation', () => {
  const validatePhone = (phone: string): boolean => {
    return /^\+?[0-9\s-]{7,15}$/.test(phone);
  };

  test('should validate correct phone numbers', () => {
    expect(validatePhone('1234567890')).toBe(true);
    expect(validatePhone('+39 123 456 7890')).toBe(true);
    expect(validatePhone('123-456-7890')).toBe(true);
  });

  test('should reject invalid phone numbers', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('')).toBe(false);
  });
});

describe('Table Number Validation', () => {
  const validateTableNumber = (input: string): string => {
    return input.replace(/[^0-9]/g, '');
  };

  test('should allow only numeric characters', () => {
    expect(validateTableNumber('12')).toBe('12');
    expect(validateTableNumber('ABC123')).toBe('123');
    expect(validateTableNumber('1a2b3c')).toBe('123');
  });

  test('should reject non-numeric input', () => {
    expect(validateTableNumber('ABC')).toBe('');
    expect(validateTableNumber('!@#$')).toBe('');
  });
});