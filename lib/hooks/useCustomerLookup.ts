/**
 * useCustomerLookup Hook
 * Cerca un cliente a partire dal numero di telefono (fisso o cellulare):
 * profilo registrato se esiste, più gli ultimi ordini per precompilare
 * l'ordine telefonico e proporre il riordino.
 */

import { supabase } from '@/lib/api/supabase';
import { useTenant } from '@/lib/stores/TenantContext';
import { buildPhoneVariants } from '@/lib/utils/phone';
import type { Product } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface CustomerLookupOrderItem {
  product: Product | null;
  quantity: number;
  notes: string | null;
}

export interface CustomerLookupOrder {
  id: string;
  created_at: string;
  total_amount: number;
  order_type: string | null;
  delivery_address: string | null;
  customer_name: string | null;
  items: CustomerLookupOrderItem[];
}

export interface CustomerLookupResult {
  /** Dati cliente (da profilo registrato, o dedotti dall'ultimo ordine) */
  customer: {
    name: string | null;
    address: string | null;
    isRegistered: boolean;
  } | null;
  orders: CustomerLookupOrder[];
}

interface RawOrderItem {
  quantity: number;
  notes: string | null;
  products: Product | null;
}

interface RawOrder {
  id: string;
  created_at: string;
  total_amount: number | null;
  order_type: string | null;
  delivery_address: string | null;
  customer_name: string | null;
  order_items: RawOrderItem[];
}

export function useCustomerLookup(rawPhone: string, enabled: boolean) {
  const { companyId } = useTenant();
  const variants = useMemo(() => buildPhoneVariants(rawPhone), [rawPhone]);

  return useQuery({
    queryKey: ['customer-lookup', companyId, variants[0] ?? ''],
    enabled: enabled && !!companyId && variants.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<CustomerLookupResult> => {
      // 1. Profilo registrato (può essere bloccato da RLS: non bloccante)
      let registeredName: string | null = null;
      let registeredAddress: string | null = null;
      let isRegistered = false;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('full_name, address, phone')
        .in('phone', variants)
        .limit(1);

      if (profilesError) {
        console.error('Customer lookup profiles error:', profilesError);
      } else if (profiles && profiles.length > 0) {
        registeredName = profiles[0].full_name;
        registeredAddress = profiles[0].address;
        isRegistered = true;
      }

      // 2. Ultimi ordini con lo stesso numero (fonte dati anche per ospiti)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(
          'id, created_at, total_amount, order_type, delivery_address, customer_name, order_items(quantity, notes, products(*))'
        )
        .in('customer_phone', variants)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) {
        console.error('Customer lookup orders error:', ordersError);
        throw ordersError;
      }

      const mappedOrders: CustomerLookupOrder[] = ((orders ?? []) as unknown as RawOrder[]).map(
        (order) => ({
          id: order.id,
          created_at: order.created_at,
          total_amount: order.total_amount ?? 0,
          order_type: order.order_type,
          delivery_address: order.delivery_address,
          customer_name: order.customer_name,
          items: (order.order_items ?? []).map((item) => ({
            product: item.products,
            quantity: item.quantity,
            notes: item.notes,
          })),
        })
      );

      const lastOrder = mappedOrders[0];
      const name = registeredName ?? lastOrder?.customer_name ?? null;
      const address =
        registeredAddress ??
        mappedOrders.find((order) => order.delivery_address)?.delivery_address ??
        null;

      return {
        customer: name || address ? { name, address, isRegistered } : null,
        orders: mappedOrders,
      };
    },
  });
}
