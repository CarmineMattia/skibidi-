/**
 * useProducts Hook
 * Fetches products from Supabase with TanStack Query, scoped to current tenant.
 */

import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import type { Product } from '@/types';
import { useQuery } from '@tanstack/react-query';

export function useProducts(categoryId?: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['products', companyId, categoryId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('company_id', companyId!)
        .order('display_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch products:', error);
        throw error;
      }

      return data as Product[];
    },
    staleTime: 0, // Always fetch fresh data to ensure updates are seen
    enabled: !!companyId,
  });
}

export function useProduct(id: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['products', companyId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId!)
        .single();

      if (error) {
        console.error('Failed to fetch product:', error);
        throw error;
      }

      return data as Product;
    },
    enabled: !!id && !!companyId,
  });
}
