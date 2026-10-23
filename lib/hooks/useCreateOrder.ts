/**
 * useCreateOrder Hook
 * Mutation hook for creating orders with order items and fiscalization
 */

import { supabase } from '@/lib/api/supabase';
import { AntiabuseError, getAntiabuseMessage, verifyTurnstileBeforeOrder } from '@/lib/utils/antiabuse';
import { toOrderLineError } from '@/lib/utils/orderLineErrors';
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
import { resolveOrderTotals, type ResolvedOrderTotals, type ServerOrderResponse } from '@/lib/utils/serverOrderTotals';
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
  turnstileToken?: string | null; // Cloudflare Turnstile (solo se EXPO_PUBLIC_TURNSTILE_SITE_KEY), monouso
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
 * Fiscal lines in cents from the confirmed prices (server ones when available).
 */
function toFiscalItems(totals: ResolvedOrderTotals): FiscalOrderData['items'] {
  const fiscalItems: FiscalOrderData['items'] = totals.lines.map((line) => ({
    product_id: line.productId,
    name: line.name,
    quantity: line.quantity,
    unit_price: Math.round(line.unitPrice * 100), // Convert to cents
    total_price: Math.round(line.totalPrice * 100),
    vat_rate: 22, // Default VAT rate (22% for food)
  }));

  if (totals.deliveryFee > 0) {
    fiscalItems.push({
      product_id: 'delivery-fee',
      name: 'Delivery Fee',
      quantity: 1,
      unit_price: Math.round(totals.deliveryFee * 100),
      total_price: Math.round(totals.deliveryFee * 100),
      vat_rate: 22,
    });
  }

  return fiscalItems;
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
      turnstileToken,
    }: CreateOrderInput): Promise<CreateOrderResult> => {
      const lang = language === 'en' ? 'en' : 'it';
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

      // 2. Client estimate (what the cart shows). The server recomputes every
      //    price from the listino and ignores these; they are still sent so the
      //    payload is the same as before (older DB function).
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
      // The order code ("Ordine #12") is assigned by the server:
      // create_order_with_items reserves it (and ignores any client value);
      // before that migration the orders trigger fills a NULL code. Reserving
      // one here as well would skip a number per order. The fallback is only
      // shown if the server response carries no code.
      let displayCode = generateFallbackOrderDisplayCode(orderId);

      const orderData: OrderInsert = {
        id: orderId,
        display_code: undefined, // omitted from the JSON: the server assigns it
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
      // Turnstile: il client verifica il token (pass monouso lato server), ma chi blocca davvero è
      // create_order_with_items, e solo se companies.require_turnstile = true. Senza site key, senza
      // token o con la funzione non deployata/non configurata si invia comunque: decide il server.
      const turnstile = await verifyTurnstileBeforeOrder(turnstileToken, (name, options) =>
        supabase.functions.invoke(name, options)
      );
      if (turnstile === 'rejected') {
        throw new AntiabuseError(getAntiabuseMessage('ANTIABUSE_CAPTCHA_REQUIRED', lang)!);
      }

      const { data: persisted, error: orderError } = await supabase.rpc('create_order_with_items', {
        p_order: orderData,
        p_items: orderItems,
      });
      if (orderError || !persisted) {
        const antiabuseMessage = getAntiabuseMessage(orderError?.message, lang);
        if (antiabuseMessage) throw new AntiabuseError(antiabuseMessage);
        const lineError = toOrderLineError(orderError, items, lang);
        if (lineError) throw lineError;
        throw new Error(`Impossibile inviare l’ordine: ${orderError?.message ?? 'salvataggio non confermato'}`);
      }
      const saved = persisted as ServerOrderResponse;
      if (saved.id !== orderId) throw new Error('Il server non ha confermato l’ordine. Riprova.');
      displayCode = saved.display_code || displayCode;
      // Server prices (lines, delivery fee, total) for receipt and confirmation.
      const confirmed = resolveOrderTotals(
        saved,
        items.map((item, index) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: orderItems[index].unit_price,
          totalPrice: orderItems[index].total_price,
        })),
        appliedDeliveryFee
      );
      const order = { id: orderId, total_amount: confirmed.total, fiscal_status: 'pending' as const };

      // 5. Fiscalize the order (unless skipped)
      let fiscalResult: FiscalProviderResult = { success: true };

      if (!skipFiscal) {
        try {
          // Prepare fiscal data
          const fiscalData: FiscalOrderData = {
            order_id: order.id,
            customer_name: customerName,
            items: toFiscalItems(confirmed),
            total_amount: Math.round(confirmed.total * 100),
            total_vat: Math.round((Math.round(confirmed.total * 100) * 22) / 122), // VAT = total * 22 / 122
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
                // Customers may only record the receipt outcome (orders are
                // locked after creation): the error stays in the console.
                fiscal_status: 'error',
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
