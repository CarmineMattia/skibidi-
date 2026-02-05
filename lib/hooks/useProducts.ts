/**
 * useProducts Hook
 * Fetches products from Supabase with TanStack Query
 */

import { supabase } from '@/lib/api/supabase';
import type { Product } from '@/types';
import { useQuery } from '@tanstack/react-query';

export function useProducts(categoryId?: string) {
  return useQuery({
    queryKey: categoryId ? ['products', categoryId] : ['products'],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('active', true)
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
    staleTime: 0, // Always fetch fresh data for now to ensure ingredients updates are seen
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Failed to fetch product:', error);
        throw error;
      }

      return data as Product;
    },
    enabled: !!id,
  });
}
