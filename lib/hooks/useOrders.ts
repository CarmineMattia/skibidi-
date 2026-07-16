/**
 * useOrders Hook
 * Query hook for fetching user orders with items
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types.generated';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export interface OrderWithItems extends Order {
  order_items: Array<OrderItem & { product: Product }>;
}

interface UseOrdersOptions {
  status?: Order['status'];
  limit?: number;
  enabled?: boolean;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { status, limit = 50, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders', { status, limit }],
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      let queryBuilder = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Orders fetch error:', error);
        throw new Error(`Errore nel recupero degli ordini: ${error.message}`);
      }

      return data as OrderWithItems[];
    },

    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000, // Realtime fallback + immediate feedback
    gcTime: 5 * 60 * 1000,
    enabled,
  });

  // Realtime: invalidate immediately on any order change visible to this user
  useEffect(() => {
    if (!enabled) return;

    let userId: string | null = null;

    const setupChannel = async (): Promise<ReturnType<typeof supabase.channel> | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      userId = user.id;
      const channel = supabase
        .channel(`user-orders-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${userId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }
        )
        .subscribe();

      return channel;
    };

    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    void setupChannel().then((ch) => { channelRef = ch; });

    return () => {
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [enabled, queryClient]);

  return query;
}

/**
 * Hook to fetch a single order by ID.
 * Usa la RPC get_order_tracking (SECURITY DEFINER) così anche gli ospiti
 * non autenticati possono tracciare il proprio ordine conoscendone l'UUID
 * (magic link). Il polling compensa l'assenza di realtime per gli anonimi.
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: async (): Promise<OrderWithItems> => {
      const { data, error } = await supabase.rpc('get_order_tracking', {
        p_order_id: orderId,
      });

      if (error) {
        console.error('Order fetch error:', error);
        throw new Error(`Errore nel recupero dell'ordine: ${error.message}`);
      }

      if (!data) {
        throw new Error('Ordine non trovato');
      }

      return data as unknown as OrderWithItems;
    },

    enabled: !!orderId, // Only run if orderId is provided
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}
