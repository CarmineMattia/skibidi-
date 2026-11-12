/**
 * useOrders Hook
 * Query hook for fetching user orders with items
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import type { Database } from '@/types/database.types.generated';
import { OrderNotFoundError, isMissingOrderResponse, isOrderNotFoundError, isValidOrderId } from '@/lib/utils/orderLookup';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export interface OrderWithItems extends Order {
  order_items: Array<OrderItem & { product: Product }>;
}

/** Fields get_order_tracking is allowed to return. No customer PII. */
export interface OrderTrackingSnapshot {
  id: string;
  status: Order['status'];
  created_at: string;
  updated_at: string | null;
  accepted_at: string | null;
  display_code: string | null;
  order_type: string | null;
  table_number: string | null;
  decline_reason_preset: string | null;
  decline_reason_note: string | null;
  declined_at: string | null;
  points_requested?: number | null;
  points_redeemed?: number | null;
  points_discount_eur?: number | null;
  points_confirmed_at?: string | null;
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
 * Hook to fetch one order for the tracking screen.
 * get_order_tracking returns only status, timestamps, order number and pickup
 * info, and only when the signed-in user owns the order (including an
 * anonymous session) or is staff. Polling covers guests who do not receive
 * the protected order row over Realtime.
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: async (): Promise<OrderTrackingSnapshot> => {
      // A made-up id never reaches the server: it is simply not an order.
      if (!isValidOrderId(orderId)) throw new OrderNotFoundError();
      const { data, error } = await supabase.rpc('get_order_tracking', {
        p_order_id: orderId,
      });

      if (isMissingOrderResponse(data, error)) {
        throw new OrderNotFoundError();
      }

      if (error) {
        console.error('Order fetch error:', error);
        throw new Error(`Errore nel recupero dell'ordine: ${error.message}`);
      }

      return data as unknown as OrderTrackingSnapshot;
    },

    enabled: !!orderId, // Only run if orderId is provided
    staleTime: 0,
    // Guests cannot receive protected order rows over Realtime: poll the
    // tracking RPC so acceptance remains visible without a WebSocket.
    // A missing order is final: no polling, no retry.
    refetchInterval: (query) => (isOrderNotFoundError(query.state.error) ? false : 5 * 1000),
    retry: (failureCount, error) => !isOrderNotFoundError(error) && failureCount < 1,
  });
}
