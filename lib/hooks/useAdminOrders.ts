/**
 * useAdminOrders Hook
 * Fetches all company orders for the admin Orders tab, with realtime updates.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import type { Database } from '@/types/database.types.generated';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type OrderStatus = Order['status'];

export interface AdminOrder extends Order {
  order_items: Array<OrderItem & { product: Product }>;
}

interface UseAdminOrdersOptions {
  statuses?: OrderStatus[];
  limit?: number;
  enabled?: boolean;
}

export function useAdminOrders(options: UseAdminOrdersOptions = {}) {
  const { statuses, limit = 100, enabled = true } = options;
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-orders', companyId, { statuses, limit }],
    queryFn: async (): Promise<AdminOrder[]> => {
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
        .order('created_at', { ascending: false })
        .limit(limit);

      if (statuses && statuses.length > 0) {
        queryBuilder = queryBuilder.in('status', statuses);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Admin orders fetch error:', error);
        throw new Error(`Errore nel recupero degli ordini: ${error.message}`);
      }

      return data as AdminOrder[];
    },
    staleTime: 10 * 1000,
    enabled: enabled && !!companyId,
  });

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`admin-orders-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-orders', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  return query;
}
