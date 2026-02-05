/**
 * useOrders Hook
 * Query hook for fetching user orders with items
 */

import { useQuery } from '@tanstack/react-query';
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
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { status, limit = 50 } = options;

  return useQuery({
    queryKey: ['orders', { status, limit }],
    queryFn: async (): Promise<OrderWithItems[]> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Build query
      let query = supabase
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

      // Apply status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Orders fetch error:', error);
        throw new Error(`Errore nel recupero degli ordini: ${error.message}`);
      }

      return data as OrderWithItems[];
    },

    // Orders change frequently, refresh every 30 seconds
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single order by ID
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: async (): Promise<OrderWithItems> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Order fetch error:', error);
        throw new Error(`Errore nel recupero dell'ordine: ${error.message}`);
      }

      return data as OrderWithItems;
    },

    enabled: !!orderId, // Only run if orderId is provided
    staleTime: 30 * 1000,
  });
}
