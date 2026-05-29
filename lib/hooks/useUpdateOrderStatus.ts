/**
 * useUpdateOrderStatus Hook
 * Mutation hook for updating order status in kitchen dashboard
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types.generated';

type OrderStatus = Database['public']['Enums']['order_status'];

interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  declineReasonPreset?: string | null;
  declineReasonNote?: string | null;
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status, declineReasonPreset = null, declineReasonNote = null }: UpdateOrderStatusInput) => {
      const isDeclined = status === 'cancelled';
      const { data, error } = await supabase
        .from('orders')
        .update({
          status,
          updated_at: new Date().toISOString(),
          decline_reason_preset: isDeclined ? declineReasonPreset : null,
          decline_reason_note: isDeclined ? declineReasonNote : null,
          declined_at: isDeclined ? new Date().toISOString() : null,
        })
        .eq('id', orderId)
        .select('id, status, decline_reason_preset, decline_reason_note')
        .single();

      if (error) {
        console.error('Order status update error:', error);
        throw new Error(`Errore nell'aggiornamento dello stato: ${error.message}`);
      }

      return data;
    },

    onSuccess: (data) => {
      console.log('✅ Order status updated:', data.id, '→', data.status);

      // Invalidate kitchen orders cache
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });

      // Also invalidate individual order cache if it exists
      queryClient.invalidateQueries({ queryKey: ['orders', data.id] });
    },

    onError: (error) => {
      console.error('❌ Update order status failed:', error);
    },
  });
}
