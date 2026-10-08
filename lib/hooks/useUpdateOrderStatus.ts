/**
 * useUpdateOrderStatus Hook
 * Mutation hook for updating order status in kitchen dashboard
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types.generated';
import { useTenant } from '@/lib/stores/TenantContext';

type OrderStatus = Database['public']['Enums']['order_status'];

interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  declineReasonPreset?: string | null;
  declineReasonNote?: string | null;
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ orderId, status, declineReasonPreset = null, declineReasonNote = null }: UpdateOrderStatusInput) => {
      const isDeclined = status === 'cancelled';
      if (!companyId) throw new Error('Ristorante non disponibile. Riprova.');
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
        .eq('company_id', companyId)
        .select('id, status, decline_reason_preset, decline_reason_note')
        .single();

      if (error) {
        console.error('Order status update error:', error);
        throw new Error(`Errore nell'aggiornamento dello stato: ${error.message}`);
      }

      if (!data || data.status !== status) {
        throw new Error('Lo stato non è stato salvato. Aggiorna gli ordini e riprova.');
      }
      return data;
    },

    onSuccess: (data) => {
      console.log('✅ Order status updated:', data.id, '→', data.status);

      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-actionable-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', data.id] });
    },

    onError: (error) => {
      console.error('❌ Update order status failed:', error);
    },
  });
}
