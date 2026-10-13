/**
 * useCreateOrder Hook
 * Mutation hook for creating orders with order items and fiscalization
 */

import { supabase } from '@/lib/api/supabase';
import { getCartItemUnitPrice, type CartItem } from '@/lib/stores/CartContext';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { useTenant } from '@/lib/stores/TenantContext';
import type { Database } from '@/types/database.types';
import type { FiscalOrderData, FiscalProviderResult, PaymentMethod } from '@/types/fiscal.types';
import { getFiscalService } from '@/lib/fiscal/FiscalService';
import { generateFallbackOrderDisplayCode } from '@/lib/utils/orderDisplayCode';
import {
  finalizeDeliveryAddress,
  getDeliveryZoneMessage,
  isAddressInDeliveryZone,
} from '@/lib/utils/deliveryZone';
import { formatOrderItemNotes } from '@/lib/utils/orderItemDetails';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { readJsonStorage, writeJsonStorage } from '@/lib/utils/storage';

type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];

interface CreateOrderInput {
  orderId?: string; // Stable id for retries after reconnecting
  items: CartItem[];
  notes?: string;
  orderType: 'eat_in' | 'take_away' | 'delivery';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
  fulfillmentMode?: 'asap' | 'scheduled';
  fulfillmentAt?: string;
  paymentMethod?: PaymentMethod; // For fiscalization
  skipFiscal?: boolean; // Option to skip fiscalization for testing
}

interface CreateOrderResult {
  orderId: string;
  displayCode: string;
  totalAmount: number;
  fiscalStatus: 'pending' | 'success' | 'error';
  fiscalExternalId?: string;
  pdfUrl?: string;
}

/**
 * Helper to convert cart items to fiscal order items
 */
function cartToFiscalItems(items: CartItem[], deliveryFee: number, orderType: CreateOrderInput['orderType']): FiscalOrderData['items'] {
  const fiscalItems = items.map(item => ({
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unit_price: Math.round(getCartItemUnitPrice(item) * 100), // Convert to cents
    total_price: Math.round(getCartItemUnitPrice(item) * item.quantity * 100),
    vat_rate: 22, // Default VAT rate (22% for food)
  }));

  if (orderType === 'delivery' && deliveryFee > 0) {
    fiscalItems.push({
      product_id: 'delivery-fee',
      name: 'Delivery Fee',
      quantity: 1,
      unit_price: Math.round(deliveryFee * 100),
      total_price: Math.round(deliveryFee * 100),
      vat_rate: 22,
    });
  }

  return fiscalItems;
}

/**
 * Helper to calculate total amount in cents
 */
function calculateTotalCents(items: CartItem[], deliveryFee: number, orderType: CreateOrderInput['orderType']): number {
  const itemsTotal = items.reduce((sum, item) => sum + getCartItemUnitPrice(item) * item.quantity, 0);
  const total = itemsTotal + (orderType === 'delivery' ? deliveryFee : 0);
  return Math.round(total * 100);
}

/**
 * Helper to calculate total VAT in cents
 */
function calculateVatCents(items: CartItem[], deliveryFee: number, orderType: CreateOrderInput['orderType']): number {
  const totalCents = calculateTotalCents(items, deliveryFee, orderType);
  return Math.round((totalCents * 22) / 122); // VAT = total * 22 / 122
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(
    readJsonStorage<{ fingerprint: string; id: string }>('ambrosia.orderSubmission.v1', 'session')
  );
  const fiscalService = getFiscalService();
  const { companyId } = useTenant();
  const { deliveryFee, language } = useAppSettings();

  return useMutation({
    mutationFn: async ({
      orderId: requestedOrderId,
      items,
      notes,
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      tableNumber,
      fulfillmentMode,
      fulfillmentAt,
      paymentMethod = 'cash',
      skipFiscal = false,
    }: CreateOrderInput): Promise<CreateOrderResult> => {
      if (!companyId) throw new Error("Ristorante non disponibile. Riprova.");
      if (!items.length) throw new Error("Il carrello è vuoto.");
      const resolvedDeliveryAddress = deliveryAddress
        ? finalizeDeliveryAddress(deliveryAddress)
        : deliveryAddress;
      if (
        orderType === 'delivery' &&
        (!resolvedDeliveryAddress?.trim() || !isAddressInDeliveryZone(resolvedDeliveryAddress))
      ) {
        throw new Error(getDeliveryZoneMessage(language === 'en' ? 'en' : 'it'));
      }

      // 1. Get current user (or null for anonymous kiosk orders)
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Calculate totals
      const itemsTotalAmount = items.reduce(
        (sum, item) => sum + getCartItemUnitPrice(item) * item.quantity,
        0
      );
      const appliedDeliveryFee = orderType === 'delivery' ? deliveryFee : 0;
      const totalAmount = itemsTotalAmount + appliedDeliveryFee;
      const normalizedNotes =
        notes ??
        (fulfillmentAt
          ? `Fulfillment mode: ${fulfillmentMode || 'asap'} | Fulfillment at: ${fulfillmentAt}`
          : undefined);

      // 3. Create order record — UUID generated client-side so we never need
      //    a SELECT after insert (which RLS would block for unauthenticated guests).
      const fingerprint = JSON.stringify({ companyId, customerId: user?.id ?? null, items, normalizedNotes, orderType, customerName, customerPhone, resolvedDeliveryAddress, tableNumber, totalAmount });
      if (!requestedOrderId && submissionRef.current?.fingerprint !== fingerprint) {
        submissionRef.current = { fingerprint, id: crypto.randomUUID() };
        writeJsonStorage('ambrosia.orderSubmission.v1', submissionRef.current, 'session');
      }
      const orderId = requestedOrderId ?? submissionRef.current!.id;
      let displayCode = generateFallbackOrderDisplayCode(orderId);

      const { data: reservedCode, error: displayCodeError } = await supabase.rpc(
        'reserve_order_display_code',
        { p_company_id: companyId! },
      );

      if (!displayCodeError && typeof reservedCode === 'string' && reservedCode.trim()) {
        displayCode = reservedCode.trim();
      }

      const orderData: OrderInsert = {
        id: orderId,
        display_code: displayCode,
        customer_id: user?.id,
        status: 'pending',
        total_amount: totalAmount,
        fiscal_status: 'pending',
        notes: normalizedNotes,
        order_type: orderType,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: resolvedDeliveryAddress,
        table_number: tableNumber,
        company_id: companyId!,
      };

      // One database transaction: kitchen never receives an empty order,
      // and reconnect retries reuse the same order instead of duplicating it.
      const orderItems: OrderItemInsert[] = items.map((item) => {
        const unitPrice = getCartItemUnitPrice(item);
        return {
          order_id: orderId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
          notes: formatOrderItemNotes(item.notes, item.modifiers, item.product.name),
        };
      });
      const { data: persisted, error: orderError } = await supabase.rpc('create_order_with_items', {
        p_order: orderData,
        p_items: orderItems,
      });
      if (orderError || !persisted) {
        throw new Error(`Impossibile inviare l’ordine: ${orderError?.message ?? 'salvataggio non confermato'}`);
      }
      const saved = persisted as { id?: string; display_code?: string; total_amount?: number };
      if (saved.id !== orderId) throw new Error('Il server non ha confermato l’ordine. Riprova.');
      displayCode = saved.display_code || displayCode;
      const order = { id: orderId, total_amount: saved.total_amount ?? totalAmount, fiscal_status: 'pending' as const };

      // 5. Fiscalize the order (unless skipped)
      let fiscalResult: FiscalProviderResult = { success: true };

      if (!skipFiscal) {
        try {
          // Prepare fiscal data
          const fiscalData: FiscalOrderData = {
            order_id: order.id,
            customer_name: customerName,
            items: cartToFiscalItems(items, appliedDeliveryFee, orderType),
            total_amount: calculateTotalCents(items, appliedDeliveryFee, orderType),
            total_vat: calculateVatCents(items, appliedDeliveryFee, orderType),
            payment_method: paymentMethod,
            timestamp: new Date().toISOString(),
          };

          // Call fiscal service
          fiscalResult = await fiscalService.emitReceipt(fiscalData);

          // 6. Update order with fiscal result
          if (fiscalResult.success) {
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                fiscal_status: 'success',
                fiscal_external_id: fiscalResult.external_id,
                pdf_url: fiscalResult.pdf_url,
              })
              .eq('id', order.id);

            if (updateError) {
              console.error('Failed to update fiscal status:', updateError);
              // Order exists but fiscal status update failed
              return {
                orderId: order.id,
                displayCode,
                totalAmount: order.total_amount,
                fiscalStatus: 'error',
              };
            }
          } else {
            // Fiscalization failed
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                fiscal_status: 'error',
                notes: `${notes || ''} | Fiscal error: ${fiscalResult.error}`,
              })
              .eq('id', order.id);

            if (updateError) {
              console.error('Failed to update fiscal error status:', updateError);
            }
          }
        } catch (fiscalError) {
          console.error('Fiscalization error:', fiscalError);

          // Mark as error but don't fail the order
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              fiscal_status: 'error',
              notes: `${notes || ''} | Fiscal service error: ${fiscalError instanceof Error ? fiscalError.message : 'Unknown'}`,
            })
            .eq('id', order.id);

          if (updateError) {
            console.error('Failed to update fiscal error status:', updateError);
          }

          fiscalResult = {
            success: false,
            error: fiscalError instanceof Error ? fiscalError.message : 'Unknown error',
          };
        }
      }

      // 7. Return result
      return {
        orderId: order.id,
        displayCode,
        totalAmount: order.total_amount,
        fiscalStatus: fiscalResult.success ? 'success' : 'error',
        fiscalExternalId: fiscalResult.external_id,
        pdfUrl: fiscalResult.pdf_url,
      };
    },

    onSuccess: () => {
      submissionRef.current = null;
      writeJsonStorage('ambrosia.orderSubmission.v1', null, 'session');
      // Invalidate orders cache so they refetch
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },

    onError: (error) => {
      console.error('Create order mutation failed:', error);
    },
  });
}
