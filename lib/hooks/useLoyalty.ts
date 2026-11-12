/**
 * Letture e azioni Skibidi Coin. Le scritture passano dalle funzioni del database.
 */

import { supabase } from '@/lib/api/supabase';
import { parseLoyaltySummary, type LoyaltySummary } from '@/lib/loyalty/points';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function asError(error: { message: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback);
}

export function useLoyaltySummary(enabled = true) {
  return useQuery({
    queryKey: ['loyalty-summary'],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<LoyaltySummary> => {
      const { data, error } = await supabase.rpc('loyalty_my_summary');
      if (error) throw asError(error, 'Saldo punti non disponibile.');
      return parseLoyaltySummary(data);
    },
  });
}

export function useLoyaltyLedger(enabled = true) {
  return useQuery({
    queryKey: ['loyalty-ledger'],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('loyalty_my_ledger', { p_limit: 30 });
      if (error) throw asError(error, 'Storico punti non disponibile.');
      return data ?? [];
    },
  });
}

export function useLoyaltyStaffLedger(enabled = true) {
  return useQuery({
    queryKey: ['loyalty-staff-ledger'],
    enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('loyalty_staff_ledger', { p_limit: 20 });
      if (error) throw asError(error, 'Storico punti non disponibile.');
      return data ?? [];
    },
  });
}

export function useLoyaltyCustomerLookup(query: string, enabled = true) {
  const text = query.trim();
  return useQuery({
    queryKey: ['loyalty-lookup', text],
    enabled: enabled && text.length >= 3,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('loyalty_lookup_customer', { p_query: text });
      if (error) throw asError(error, 'Ricerca cliente non disponibile.');
      return data ?? [];
    },
  });
}

export function useLoyaltyGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { customerId: string; quantity: number; reason: string }) => {
      const { data, error } = await supabase.rpc('loyalty_gift', {
        p_customer: input.customerId,
        p_quantity: input.quantity,
        p_reason: input.reason,
      });
      if (error) throw asError(error, 'Omaggio non registrato.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-staff-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-lookup'] });
    },
  });
}

export function useConfirmLoyaltyRedeem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('loyalty_confirm_redeem', { p_order_id: orderId });
      if (error) throw asError(error, 'Sconto punti non confermato.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-staff-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
