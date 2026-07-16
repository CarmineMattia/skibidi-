import { DeclineReasonModal } from '@/components/features/orders/DeclineReasonModal';
import { useOrderAlertSound } from '@/lib/hooks/useOrderAlertSound';
import { useUpdateOrderStatus } from '@/lib/hooks/useUpdateOrderStatus';
import { supabase } from '@/lib/api/supabase';
import { useAuth } from '@/lib/stores/AuthContext';
import { useTenant } from '@/lib/stores/TenantContext';
import { getOrderDisplayCode } from '@/lib/utils/orderDisplayCode';
import { buildAdminOrderRealtimeNotice } from '@/lib/utils/orderRealtimeNotifications';
import { FontAwesome } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

type IncomingOrder = {
  id: string;
  display_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount: number;
  order_type?: string | null;
  delivery_address?: string | null;
  table_number?: string | null;
  created_at: string;
};

type OrderNotificationContextValue = {
  pendingCount: number;
};

const OrderNotificationContext = createContext<OrderNotificationContextValue>({ pendingCount: 0 });

export function useOrderNotifications() {
  return useContext(OrderNotificationContext);
}

function mapIncomingOrder(row: Record<string, unknown>): IncomingOrder | null {
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;

  return {
    id,
    display_code: typeof row.display_code === 'string' ? row.display_code : null,
    customer_name: typeof row.customer_name === 'string' ? row.customer_name : null,
    customer_phone: typeof row.customer_phone === 'string' ? row.customer_phone : null,
    total_amount: typeof row.total_amount === 'number' ? row.total_amount : 0,
    order_type: typeof row.order_type === 'string' ? row.order_type : null,
    delivery_address: typeof row.delivery_address === 'string' ? row.delivery_address : null,
    table_number: typeof row.table_number === 'string' ? row.table_number : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function getOrderTypeLabel(orderType?: string | null): string {
  if (orderType === 'delivery') return 'Delivery';
  if (orderType === 'take_away') return 'Asporto';
  if (orderType === 'eat_in') return 'Sala';
  return 'Ordine';
}

export function OrderNotificationProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { companyId } = useTenant();
  const { playAlert } = useOrderAlertSound();
  const updateOrderStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<IncomingOrder[]>([]);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    title: string;
    message: string;
    tone: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);
  const handledIdsRef = useRef<Set<string>>(new Set());

  const activeOrder = queue[0] ?? null;

  const enqueueOrder = useCallback((order: IncomingOrder) => {
    if (handledIdsRef.current.has(order.id)) return;
    setQueue((current) => {
      if (current.some((item) => item.id === order.id)) return current;
      return [...current, order];
    });
  }, []);

  const dequeueOrder = useCallback((orderId: string) => {
    handledIdsRef.current.add(orderId);
    setQueue((current) => current.filter((item) => item.id !== orderId));
    setShowDeclineModal(false);
  }, []);

  const loadPendingOrders = useCallback(async () => {
    if (!companyId || !isAdmin) return;

    const primarySelect =
      'id, display_code, customer_name, customer_phone, total_amount, order_type, delivery_address, table_number, created_at';
    const fallbackSelect =
      'id, customer_name, customer_phone, total_amount, order_type, delivery_address, table_number, created_at';

    let data: Record<string, unknown>[] | null = null;
    let error: { message: string } | null = null;

    {
      const response = await supabase
      .from('orders')
      .select(primarySelect)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);
      data = (response.data as Record<string, unknown>[] | null) ?? null;
      error = response.error;
    }

    if (error && /display_code/i.test(error.message)) {
      const fallbackResponse = await supabase
        .from('orders')
        .select(fallbackSelect)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);
      data = (fallbackResponse.data as Record<string, unknown>[] | null) ?? null;
      error = fallbackResponse.error;
    }

    if (error) {
      console.error('[OrderNotification] pending fetch failed:', error);
      return;
    }

    (data ?? []).forEach((row) => {
      const mapped = mapIncomingOrder(row as Record<string, unknown>);
      if (mapped) enqueueOrder(mapped);
    });
  }, [companyId, enqueueOrder, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !companyId) {
      setQueue([]);
      return;
    }

    void loadPendingOrders();
  }, [companyId, isAdmin, loadPendingOrders]);

  useEffect(() => {
    if (!isAdmin || !companyId) return;

    const channel = supabase
      .channel(`order-notifications-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          if (next.status !== 'pending') return;
          const mapped = mapIncomingOrder(next);
          if (!mapped) return;
          void playAlert('new-order', mapped.id);
          enqueueOrder(mapped);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const next = payload.new as { id?: string; status?: string; display_code?: string | null };
          const prev = payload.old as { status?: string };
          const orderId = next.id;
          if (!orderId) return;

          if (next.status !== 'pending') {
            dequeueOrder(orderId);
          }

          const notice = buildAdminOrderRealtimeNotice({
            previousStatus: prev.status,
            nextStatus: next.status,
            orderCode: getOrderDisplayCode({
              id: orderId,
              display_code: typeof next.display_code === 'string' ? next.display_code : null,
            }),
          });
          if (notice) {
            setStatusNotice(notice);
          }

          if (next.status === 'ready' && prev.status !== 'ready') {
            void playAlert('order-ready', orderId);
          }

          void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-actionable-orders'] });
          void queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Also closes the gap between the initial fetch and channel readiness.
          void loadPendingOrders();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, dequeueOrder, enqueueOrder, isAdmin, loadPendingOrders, playAlert, queryClient]);

  useEffect(() => {
    if (!isAdmin || !companyId) return;

    // Safety net for suspended WebSockets/backgrounded devices.
    const interval = setInterval(() => {
      void loadPendingOrders();
    }, 10_000);

    return () => clearInterval(interval);
  }, [companyId, isAdmin, loadPendingOrders]);

  useEffect(() => {
    if (!statusNotice) return;
    const timeout = setTimeout(() => setStatusNotice(null), 4500);
    return () => clearTimeout(timeout);
  }, [statusNotice]);

  const handleAccept = () => {
    if (!activeOrder) return;
    updateOrderStatus.mutate(
      {
        orderId: activeOrder.id,
        status: 'preparing',
      },
      {
        onSuccess: () => dequeueOrder(activeOrder.id),
      }
    );
  };

  const handleDecline = (payload: { preset: string; note: string }) => {
    if (!activeOrder) return;
    updateOrderStatus.mutate(
      {
        orderId: activeOrder.id,
        status: 'cancelled',
        declineReasonPreset: payload.preset,
        declineReasonNote: payload.note || null,
      },
      {
        onSuccess: () => dequeueOrder(activeOrder.id),
      }
    );
  };

  const contextValue = useMemo(() => ({ pendingCount: queue.length }), [queue.length]);

  return (
    <OrderNotificationContext.Provider value={contextValue}>
      {children}

      <Modal
        visible={Boolean(isAdmin && activeOrder && !showDeclineModal)}
        animationType="fade"
        transparent
        onRequestClose={() => undefined}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-5">
          <View className="w-full max-w-lg rounded-2xl bg-white border border-[#e1a255]/50 p-5 shadow-2xl">
            <View className="flex-row items-start gap-3 mb-4">
              <View className="w-12 h-12 rounded-full bg-[#8d171e] items-center justify-center">
                <FontAwesome name="bell" size={20} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">
                  Nuovo ordine in arrivo
                </Text>
                <Text className="text-2xl font-black text-gray-900 mt-1">
                  {activeOrder ? getOrderDisplayCode(activeOrder) : ''}
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  {activeOrder?.customer_name || 'Cliente'} • €{activeOrder?.total_amount.toFixed(2) ?? '0.00'}
                </Text>
              </View>
              {queue.length > 1 ? (
                <View className="bg-[#f3dabb] rounded-full px-2 py-1">
                  <Text className="text-[10px] font-bold text-[#8d171e]">+{queue.length - 1}</Text>
                </View>
              ) : null}
            </View>

            <View className="rounded-xl bg-[#f9ecdd] border border-[#e1a255]/40 p-3 mb-4 gap-1">
              <Text className="text-sm font-bold text-gray-900">
                {activeOrder ? getOrderTypeLabel(activeOrder.order_type) : ''}
                {activeOrder?.table_number ? ` • Tavolo ${activeOrder.table_number}` : ''}
              </Text>
              {activeOrder?.delivery_address ? (
                <Text className="text-xs text-gray-700">{activeOrder.delivery_address}</Text>
              ) : null}
              {activeOrder?.customer_phone ? (
                <Text className="text-xs text-gray-700">{activeOrder.customer_phone}</Text>
              ) : null}
              <Text className="text-[11px] text-gray-500 mt-1">
                Arrivato alle{' '}
                {activeOrder
                  ? new Date(activeOrder.created_at).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  : '--:--'}
              </Text>
            </View>

            <Text className="text-sm text-gray-600 mb-4">
              Accetta per avviare la preparazione oppure rifiuta indicando il motivo (anche ripianificazione).
            </Text>

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 h-12 rounded-xl border border-red-300 bg-red-50 items-center justify-center active:opacity-90"
                onPress={() => setShowDeclineModal(true)}
                disabled={updateOrderStatus.isPending}
              >
                <Text className="font-bold text-red-700">Rifiuta</Text>
              </Pressable>
              <Pressable
                className="flex-1 h-12 rounded-xl bg-emerald-600 items-center justify-center active:opacity-90"
                onPress={handleAccept}
                disabled={updateOrderStatus.isPending}
              >
                {updateOrderStatus.isPending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="font-bold text-white">Accetta ordine</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <DeclineReasonModal
        visible={showDeclineModal && Boolean(activeOrder)}
        onClose={() => setShowDeclineModal(false)}
        onConfirm={handleDecline}
        isSubmitting={updateOrderStatus.isPending}
      />

      <Modal
        visible={Boolean(isAdmin && statusNotice)}
        animationType="fade"
        transparent
        onRequestClose={() => setStatusNotice(null)}
      >
        <View className="flex-1 justify-start items-center pt-14 px-4" pointerEvents="none">
          {statusNotice ? (
            <View
              className={`w-full max-w-lg rounded-2xl border px-4 py-3 shadow-lg ${
                statusNotice.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200'
                  : statusNotice.tone === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : statusNotice.tone === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-sky-50 border-sky-200'
              }`}
            >
              <Text
                className={`text-xs font-bold uppercase tracking-wider ${
                  statusNotice.tone === 'success'
                    ? 'text-emerald-700'
                    : statusNotice.tone === 'warning'
                      ? 'text-amber-700'
                      : statusNotice.tone === 'error'
                        ? 'text-red-700'
                        : 'text-sky-700'
                }`}
              >
                Aggiornamento live
              </Text>
              <Text className="text-base font-extrabold text-gray-900 mt-1">{statusNotice.title}</Text>
              <Text className="text-sm text-gray-700 mt-1">{statusNotice.message}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </OrderNotificationContext.Provider>
  );
}
