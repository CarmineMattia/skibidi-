/**
 * useCreateOrder Hook
 * Mutation hook for creating orders with order items and fiscalization
 */

import { supabase } from '@/lib/api/supabase';
import type { CartItem } from '@/lib/stores/CartContext';
import type { Database } from '@/types/database.types';
import type { FiscalOrderData, FiscalProviderResult, PaymentMethod } from '@/types/fiscal.types';
import { getFiscalService } from '@/lib/fiscal/FiscalService';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];

interface CreateOrderInput {
  items: CartItem[];
  notes?: string;
  orderType: 'eat_in' | 'take_away' | 'delivery';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
  paymentMethod?: PaymentMethod; // For fiscalization
  skipFiscal?: boolean; // Option to skip fiscalization for testing
}

interface CreateOrderResult {
  orderId: string;
  totalAmount: number;
  fiscalStatus: 'pending' | 'success' | 'error';
  fiscalExternalId?: string;
  pdfUrl?: string;
}

/**
 * Helper to convert cart items to fiscal order items
 */
function cartToFiscalItems(items: CartItem[]): FiscalOrderData['items'] {
  return items.map(item => ({
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unit_price: Math.round(item.product.price * 100), // Convert to cents
    total_price: Math.round(item.product.price * item.quantity * 100),
    vat_rate: 22, // Default VAT rate (22% for food)
  }));
}

/**
 * Helper to calculate total amount in cents
 */
function calculateTotalCents(items: CartItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * 100,
  );
}

/**
 * Helper to calculate total VAT in cents
 */
function calculateVatCents(items: CartItem[]): number {
  const totalCents = calculateTotalCents(items);
  return Math.round((totalCents * 22) / 122); // VAT = total * 22 / 122
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const fiscalService = getFiscalService();

  return useMutation({
    mutationFn: async ({
      items,
      notes,
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      tableNumber,
      paymentMethod = 'cash',
      skipFiscal = false,
    }: CreateOrderInput): Promise<CreateOrderResult> => {
      // 1. Get current user (or null for anonymous kiosk orders)
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Calculate totals
      const totalAmount = items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      // 3. Create order record
      const orderData: OrderInsert = {
        customer_id: user?.id,
        status: 'pending',
        total_amount: totalAmount,
        fiscal_status: 'pending',
        notes: notes,
        order_type: orderType,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        table_number: tableNumber,
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id, total_amount, fiscal_status')
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw new Error(`Errore nella creazione dell'ordine: ${orderError.message}`);
      }

      // 4. Create order items (bulk insert)
      const orderItems: OrderItemInsert[] = items.map((item) => {
        // Combine notes and modifiers
        let finalNotes = item.notes || '';
        if (item.modifiers && item.modifiers.length > 0) {
          const modifiersString = item.modifiers.join(', ');
          finalNotes = finalNotes ? `${finalNotes} | ${modifiersString}` : modifiersString;
        }

        return {
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          total_price: item.product.price * item.quantity,
          notes: finalNotes || undefined,
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Order items creation error:', itemsError);

        // Rollback: delete order if items failed
        await supabase.from('orders').delete().eq('id', order.id);

        throw new Error(`Errore nell'aggiunta dei prodotti: ${itemsError.message}`);
      }

      // 5. Fiscalize the order (unless skipped)
      let fiscalResult: FiscalProviderResult = { success: true };

      if (!skipFiscal) {
        try {
          // Prepare fiscal data
          const fiscalData: FiscalOrderData = {
            order_id: order.id,
            customer_name: customerName,
            items: cartToFiscalItems(items),
            total_amount: calculateTotalCents(items),
            total_vat: calculateVatCents(items),
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
        totalAmount: order.total_amount,
        fiscalStatus: fiscalResult.success ? 'success' : 'error',
        fiscalExternalId: fiscalResult.external_id,
        pdfUrl: fiscalResult.pdf_url,
      };
    },

    onSuccess: () => {
      // Invalidate orders cache so they refetch
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },

    onError: (error) => {
      console.error('Create order mutation failed:', error);
    },
  });
}
