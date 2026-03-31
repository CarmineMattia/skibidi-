/**
 * useCategories Hook
 * Fetches categories from Supabase with TanStack Query, scoped to current tenant.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import type { Category } from '@/types';

export function useCategories() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['categories', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .eq('company_id', companyId!)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
      }

      return data as Category[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - categories rarely change
    enabled: !!companyId,
  });
}
