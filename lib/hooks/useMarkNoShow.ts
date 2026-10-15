import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import { markOrderNoShow } from '@/lib/orders/noShow';

export function useMarkNoShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note?: string }) =>
      markOrderNoShow(supabase as unknown as Parameters<typeof markOrderNoShow>[0], orderId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-actionable-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}
