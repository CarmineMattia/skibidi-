/**
 * useKitchenOrders Hook
 * Real-time query hook for kitchen dashboard with Supabase subscriptions
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types.generated';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export interface KitchenOrder extends Order {
  order_items: Array<OrderItem & { product: Product }>;
}

interface UseKitchenOrdersOptions {
  statuses?: Order['status'][];
}

export function useKitchenOrders(options: UseKitchenOrdersOptions = {}) {
  const { statuses = ['pending', 'preparing', 'ready'] } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['kitchen-orders', { statuses }],
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
        .order('created_at', { ascending: true });

      // Filter by statuses
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

    // Refresh every 10 seconds as fallback
    refetchInterval: 10 * 1000,
    staleTime: 5 * 1000,
  });

  // Set up Realtime subscription
  useEffect(() => {
    console.log('🔴 Setting up Realtime subscription for orders...');

    const channel = supabase
      .channel('kitchen-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('🔔 Order changed:', payload);

          // Invalidate and refetch orders when any change occurs
          queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('🔴 Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient, statuses]);

  return query;
}
