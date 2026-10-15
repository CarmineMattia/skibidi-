import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import { fetchMarkedNoShowOrderIds, markOrderNoShow } from '@/lib/orders/noShow';
import { useQuery } from '@tanstack/react-query';

export function useMarkNoShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note?: string }) =>
      markOrderNoShow(supabase as unknown as Parameters<typeof markOrderNoShow>[0], orderId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-actionable-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-no-show-orders'] });
    },
  });
}

/** Ordini (tra quelli passati) che hanno già un "non ritirato" registrato. */
export function useMarkedNoShowOrderIds(orderIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['admin-no-show-orders', orderIds],
    enabled: enabled && orderIds.length > 0,
    queryFn: () =>
      fetchMarkedNoShowOrderIds(supabase as unknown as Parameters<typeof fetchMarkedNoShowOrderIds>[0], orderIds),
  });
}
