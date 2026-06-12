/**
 * useKitchenOrders Hook
 * Real-time query hook for kitchen dashboard with Supabase subscriptions, scoped to tenant.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import type { Database } from '@/types/database.types.generated';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export interface KitchenOrder extends Order {
  order_items: Array<OrderItem & { product: Product }>;
}

interface UseKitchenOrdersOptions {
  statuses?: Order['status'][];
  onOrderEvent?: (event: { type: 'new-order' | 'order-ready'; orderId: string }) => void;
}

export function useKitchenOrders(options: UseKitchenOrdersOptions = {}) {
  const { statuses = ['pending', 'preparing', 'ready'], onOrderEvent } = options;
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  // Keep ref current every render so the effect closure never goes stale
  const onOrderEventRef = useRef(onOrderEvent);
  onOrderEventRef.current = onOrderEvent;

  const query = useQuery({
    queryKey: ['kitchen-orders', companyId, { statuses }],
    queryFn: async (): Promise<KitchenOrder[]> => {
      let queryBuilder = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          )
        `)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: true });

      if (statuses.length > 0) {
        queryBuilder = queryBuilder.in('status', statuses);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Kitchen orders fetch error:', error);
        throw new Error(`Errore nel recupero degli ordini: ${error.message}`);
      }

      return data as KitchenOrder[];
    },

    refetchInterval: 10 * 1000, // Fallback poll every 10 s
    staleTime: 5 * 1000,
    enabled: !!companyId,
  });

  // Set up Realtime subscription
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`kitchen-orders-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const nextOrder = payload.new as { id?: string; status?: Order['status'] } | null;
          const prevOrder = payload.old as { status?: Order['status'] } | null;

          if (payload.eventType === 'INSERT' && nextOrder?.id && nextOrder.status === 'pending') {
            onOrderEventRef.current?.({ type: 'new-order', orderId: nextOrder.id });
          }

          if (
            payload.eventType === 'UPDATE' &&
            nextOrder?.id &&
            nextOrder.status === 'ready' &&
            prevOrder?.status !== 'ready'
          ) {
            onOrderEventRef.current?.({ type: 'order-ready', orderId: nextOrder.id });
          }

          queryClient.invalidateQueries({ queryKey: ['kitchen-orders', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  return query;
}
