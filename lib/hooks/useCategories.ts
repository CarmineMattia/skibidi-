/**
 * useCategories Hook
 * Fetches categories from Supabase with TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import type { Category } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
      }

      return data as Category[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - categories rarely change
  });
}
