/**
 * usePayment Hook
 * Mock Stripe integration for payment processing
 */

import type { CartItem } from '@/lib/stores/CartContext';
import { useMutation } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export type PaymentProvider = 'stripe' | 'cash' | 'terminal';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'error' | 'cancelled';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown';

export interface SavedCard {
  id: string;
  brand: CardBrand;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface ProcessPaymentInput {
  amount: number; // in cents
  currency?: string;
  provider: PaymentProvider;
  savedCardId?: string; // If using saved card
  cardDetails?: {
    // If new card
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  };
  metadata?: Record<string, string>;
}

export interface ProcessPaymentResult {
  success: boolean;
  paymentIntentId?: string;
  transactionId?: string;
  error?: string;
  receiptUrl?: string;
}

// ============================================================================
// MOCK STRIPE INTEGRATION
// ============================================================================

/**
 * Mock function to create a payment intent
 * In production, this would call your backend which creates the intent on Stripe
 */
async function createPaymentIntent(
  amount: number,
  currency: string = 'eur'
): Promise<PaymentIntent> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock payment intent
  return {
    id: `pi_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    clientSecret: `pi_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
    amount,
    currency,
    status: 'requires_payment_method',
  };
}

/**
 * Mock function to process a payment
 * In production, this would confirm the payment intent on Stripe
 */
async function processPaymentIntent(
  paymentIntentId: string,
  cardDetails?: ProcessPaymentInput['cardDetails']
): Promise<ProcessPaymentResult> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Simulate 95% success rate
  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    return {
      success: true,
      paymentIntentId,
      transactionId: `txn_${Date.now()}`,
      receiptUrl: `https://pay.stripe.com/receipts/${paymentIntentId}`,
    };
  }

  // Simulate specific errors
  const errors = [
    { code: 'card_declined', message: 'La carta è stata rifiutata' },
    { code: 'insufficient_funds', message: 'Fondi insufficienti' },
    { code: 'expired_card', message: 'La carta è scaduta' },
    { code: 'processing_error', message: 'Errore durante l\'elaborazione' },
  ];

  const randomError = errors[Math.floor(Math.random() * errors.length)];

  return {
    success: false,
    paymentIntentId,
    error: randomError.message,
  };
}

// ============================================================================
// HOOK
// ============================================================================

interface UsePaymentOptions {
  onSuccess?: (result: ProcessPaymentResult) => void;
  onError?: (error: Error) => void;
}

export function usePayment(options: UsePaymentOptions = {}) {
  const { onSuccess, onError } = options;

  return useMutation({
    mutationFn: async (input: ProcessPaymentInput): Promise<ProcessPaymentResult> => {
      // Step 1: Create payment intent
      const paymentIntent = await createPaymentIntent(input.amount, input.currency);

      // Step 2: Process payment (confirm intent)
      const result = await processPaymentIntent(paymentIntent.id, input.cardDetails);

      return result;
    },

    onSuccess: (result) => {
      if (result.success) {
        onSuccess?.(result);
      } else {
        onError?.(new Error(result.error || 'Payment failed'));
      }
    },

    onError: (error) => {
      console.error('[Payment] Error:', error);
      onError?.(error);
    },
  });
}

// ============================================================================
// PAYMENT UTILITIES
// ============================================================================

/**
 * Calculate total amount in cents from cart items
 */
export function calculatePaymentAmount(items: CartItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * 100
  );
}

/**
 * Format card number for display
 */
export function formatCardNumber(number: string): string {
  const cleaned = number.replace(/\s/g, '').replace(/\D/g, '');
  const chunks = cleaned.match(/.{1,4}/g) || [];
  return chunks.join(' ').substring(0, 19);
}

/**
 * Detect card brand from number
 */
export function detectCardBrand(number: string): CardBrand {
  const cleaned = number.replace(/\D/g, '');

  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';

  return 'unknown';
}

/**
 * Format expiry date for display
 */
export function formatExpiry(month: number, year: number): string {
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
}

/**
 * Validate card number using Luhn algorithm
 */
export function isValidCardNumber(number: string): boolean {
  const cleaned = number.replace(/\D/g, '');

  if (cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// ============================================================================
// MOCK SAVED CARDS (for demo)
// ============================================================================

export function getMockSavedCards(): SavedCard[] {
  return [
    {
      id: 'card_visa_1234',
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2027,
      isDefault: true,
    },
    {
      id: 'card_mc_5678',
      brand: 'mastercard',
      last4: '8888',
      expiryMonth: 6,
      expiryYear: 2026,
      isDefault: false,
    },
  ];
}