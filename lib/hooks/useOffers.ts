import { resolveComboOffers } from '@/lib/data/offers';
import { useProducts } from '@/lib/hooks/useProducts';
import { useMemo } from 'react';

export function useOffers() {
  const { data: products = [], isLoading, refetch, isRefetching } = useProducts();

  const offers = useMemo(() => resolveComboOffers(products), [products]);

  return { offers, products, isLoading, refetch, isRefetching };
}
