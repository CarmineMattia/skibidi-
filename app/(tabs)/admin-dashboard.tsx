import { supabase } from '@/lib/api/supabase';
import { DeclineReasonModal } from '@/components/features/orders/DeclineReasonModal';
import { useOrderAlertSound } from '@/lib/hooks/useOrderAlertSound';
import { useUpdateOrderStatus } from '@/lib/hooks/useUpdateOrderStatus';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { useAuth } from '@/lib/stores/AuthContext';
import { useTenant } from '@/lib/stores/TenantContext';
import { FontAwesome } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TimeRangeKey = 'today' | '7d' | '30d';
type MetricKey = 'orders' | 'pending' | 'revenue' | 'avgTicket' | 'products';

type OrderRow = {
  created_at: string;
  total_amount: number | null;
  status: string;
  order_type: string | null;
};

type DashboardStats = {
  orders: OrderRow[];
  todayOrders: number;
  pendingOrders: number;
  todayRevenue: number;
  avgTicket: number;
  productsActive: number;
  last7DaysOrders: Array<{ dayLabel: string; count: number }>;
  statusBreakdown: Array<{ label: string; value: number; color: string }>;
};

type ActionableOrder = {
  id: string;
  created_at: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  total_amount: number;
  customer_name: string | null;
  decline_reason_preset: string | null;
  decline_reason_note: string | null;
};

export default function AdminDashboardScreen() {
  const { isAdmin } = useAuth();
  const { companyId } = useTenant();
  const {
    acceptingOrders,
    ordersPausedUntil,
    maxOrdersPerWindow,
    deliveryMaxOrdersPerWindow,
  } = useAppSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('today');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('orders');
  const [selectedHourLabel, setSelectedHourLabel] = useState<string | null>(null);
  const [declineOrderId, setDeclineOrderId] = useState<string | null>(null);
  const updateOrderStatus = useUpdateOrderStatus();
  const { playAlert } = useOrderAlertSound();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard-stats', companyId],
    enabled: Boolean(companyId) && isAdmin,
    queryFn: async (): Promise<DashboardStats> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();
      const start7Days = new Date(startOfDay);
      start7Days.setDate(startOfDay.getDate() - 6);
      const start35Days = new Date(startOfDay);
      start35Days.setDate(startOfDay.getDate() - 34);

      const [
        { data: todayOrders, error: todayOrdersError },
        { data: pendingOrders, error: pendingOrdersError },
        { data: products, error: productsError },
        { data: weeklyOrders, error: weeklyOrdersError },
        { data: rollingOrders, error: rollingOrdersError },
      ] =
        await Promise.all([
          supabase
            .from('orders')
            .select('id, total_amount')
            .eq('company_id', companyId!)
            .gte('created_at', startIso),
          supabase
            .from('orders')
            .select('id')
            .eq('company_id', companyId!)
            .in('status', ['pending', 'preparing']),
          supabase
            .from('products')
            .select('id')
            .eq('company_id', companyId!)
            .eq('active', true),
          supabase
            .from('orders')
            .select('created_at, status')
            .eq('company_id', companyId!)
            .gte('created_at', start7Days.toISOString()),
          supabase
            .from('orders')
            .select('created_at, total_amount, status, order_type')
            .eq('company_id', companyId!)
            .gte('created_at', start35Days.toISOString()),
        ]);

      if (todayOrdersError) throw todayOrdersError;
      if (pendingOrdersError) throw pendingOrdersError;
      if (productsError) throw productsError;
      if (weeklyOrdersError) throw weeklyOrdersError;
      if (rollingOrdersError) throw rollingOrdersError;

      const dayMap = new Map<string, number>();
      const days: Array<{ key: string; dayLabel: string }> = [];
      for (let i = 6; i >= 0; i -= 1) {
        const day = new Date(startOfDay);
        day.setDate(startOfDay.getDate() - i);
        const key = day.toISOString().slice(0, 10);
        const dayLabel = day.toLocaleDateString('it-IT', { weekday: 'short' });
        dayMap.set(key, 0);
        days.push({ key, dayLabel });
      }

      const statusCounts = {
        pending: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0,
      };

      (weeklyOrders ?? []).forEach((order) => {
        const key = order.created_at.slice(0, 10);
        if (dayMap.has(key)) {
          dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
        }
        if (order.status in statusCounts) {
          const typedStatus = order.status as keyof typeof statusCounts;
          statusCounts[typedStatus] += 1;
        }
      });

      const todayRevenue = (todayOrders ?? []).reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
      const todayOrdersCount = todayOrders?.length ?? 0;

      return {
        orders: (rollingOrders ?? []) as OrderRow[],
        todayOrders: todayOrdersCount,
        pendingOrders: pendingOrders?.length ?? 0,
        todayRevenue,
        avgTicket: todayOrdersCount > 0 ? todayRevenue / todayOrdersCount : 0,
        productsActive: products?.length ?? 0,
        last7DaysOrders: days.map((day) => ({
          dayLabel: day.dayLabel,
          count: dayMap.get(day.key) ?? 0,
        })),
        statusBreakdown: [
          { label: 'Nuovi', value: statusCounts.pending, color: '#f59e0b' },
          { label: 'Prep.', value: statusCounts.preparing, color: '#3b82f6' },
          { label: 'Pronti', value: statusCounts.ready, color: '#10b981' },
          { label: 'Consegnati', value: statusCounts.delivered, color: '#6b7280' },
          { label: 'Annullati', value: statusCounts.cancelled, color: '#ef4444' },
        ],
      };
    },
  });

  const { data: actionableOrders = [] } = useQuery({
    queryKey: ['admin-actionable-orders', companyId],
    enabled: Boolean(companyId) && isAdmin,
    queryFn: async (): Promise<ActionableOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, status, total_amount, customer_name, decline_reason_preset, decline_reason_note')
        .eq('company_id', companyId!)
        .in('status', ['pending', 'preparing', 'ready', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data ?? []) as ActionableOrder[];
    },
  });

  if (!isAdmin) {
    router.replace('/(tabs)');
    return null;
  }

  const pausedUntilDate =
    ordersPausedUntil && !Number.isNaN(new Date(ordersPausedUntil).getTime())
      ? new Date(ordersPausedUntil)
      : null;
  const isKitchenOpen = acceptingOrders && (!pausedUntilDate || pausedUntilDate.getTime() <= Date.now());
  const maxDailyBar = useMemo(
    () => Math.max(1, ...(data?.last7DaysOrders.map((item) => item.count) ?? [1])),
    [data?.last7DaysOrders]
  );
  const statusTotal = useMemo(
    () => (data?.statusBreakdown ?? []).reduce((sum, item) => sum + item.value, 0),
    [data?.statusBreakdown]
  );
  const selectedRangeStats = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (timeRange === '7d') start.setDate(start.getDate() - 6);
    if (timeRange === '30d') start.setDate(start.getDate() - 29);

    const filteredOrders = data.orders.filter((order) => new Date(order.created_at).getTime() >= start.getTime());
    const revenue = filteredOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
    const avgTicket = filteredOrders.length > 0 ? revenue / filteredOrders.length : 0;
    const pending = filteredOrders.filter((order) => order.status === 'pending' || order.status === 'preparing').length;

    return {
      ordersCount: filteredOrders.length,
      pendingCount: pending,
      revenue,
      avgTicket,
      filteredOrders,
    };
  }, [data, timeRange]);
  const hourlyOrders = useMemo(() => {
    const bucket = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, '0')}:00`,
      count: 0,
      delivery: 0,
      nonDelivery: 0,
    }));
    if (!selectedRangeStats) return bucket;

    selectedRangeStats.filteredOrders.forEach((order) => {
      const createdAt = new Date(order.created_at);
      const hour = createdAt.getHours();
      const entry = bucket[hour];
      entry.count += 1;
      if (order.order_type === 'delivery') {
        entry.delivery += 1;
      } else {
        entry.nonDelivery += 1;
      }
    });

    return bucket;
  }, [selectedRangeStats]);
  const maxHourlyOrders = useMemo(
    () => Math.max(1, ...hourlyOrders.map((item) => item.count)),
    [hourlyOrders]
  );
  const nextTwoHoursForecast = useMemo(() => {
    const now = new Date();
    const weekday = now.getDay();
    const forecasts: Array<{
      label: string;
      expectedTotal: number;
      expectedDelivery: number;
      expectedNonDelivery: number;
      capacityTotal: number;
      capacityDelivery: number;
      risk: 'ok' | 'warning' | 'critical';
    }> = [];

    for (let offset = 1; offset <= 2; offset += 1) {
      const targetHour = (now.getHours() + offset) % 24;
      const matching = (data?.orders ?? []).filter((order) => {
        const dt = new Date(order.created_at);
        return dt.getDay() === weekday && dt.getHours() === targetHour;
      });
      const deliveryCount = matching.filter((order) => order.order_type === 'delivery').length;
      const nonDeliveryCount = matching.length - deliveryCount;
      const baselineDivisor = 4; // approx same weekday in 4 recent weeks
      const expectedTotal = Math.round(matching.length / baselineDivisor);
      const expectedDelivery = Math.round(deliveryCount / baselineDivisor);
      const expectedNonDelivery = Math.round(nonDeliveryCount / baselineDivisor);
      const capacityTotal = maxOrdersPerWindow;
      const capacityDelivery = deliveryMaxOrdersPerWindow;
      const loadRatio = capacityTotal > 0 ? expectedTotal / capacityTotal : 0;
      const risk: 'ok' | 'warning' | 'critical' =
        loadRatio >= 1 ? 'critical' : loadRatio >= 0.75 ? 'warning' : 'ok';

      forecasts.push({
        label: `${String(targetHour).padStart(2, '0')}:00`,
        expectedTotal,
        expectedDelivery,
        expectedNonDelivery,
        capacityTotal,
        capacityDelivery,
        risk,
      });
    }
    return forecasts;
  }, [data?.orders, deliveryMaxOrdersPerWindow, maxOrdersPerWindow]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`admin-dashboard-orders-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string; id?: string } | null)?.status;
          const nextId = (payload.new as { status?: string; id?: string } | null)?.id;
          const prevStatus = (payload.old as { status?: string } | null)?.status;
          if (payload.eventType === 'INSERT' && nextStatus === 'pending' && nextId) {
            void playAlert('new-order', nextId);
          }
          if (payload.eventType === 'UPDATE' && nextStatus === 'ready' && prevStatus !== 'ready' && nextId) {
            void playAlert('order-ready', nextId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, playAlert]);

  const getNextStatus = (status: ActionableOrder['status']): ActionableOrder['status'] | null => {
    if (status === 'pending') return 'preparing';
    if (status === 'preparing') return 'ready';
    if (status === 'ready') return 'delivered';
    return null;
  };

  const handleDeclineOrder = (payload: { preset: string; note: string }) => {
    if (!declineOrderId) return;
    updateOrderStatus.mutate(
      {
        orderId: declineOrderId,
        status: 'cancelled',
        declineReasonPreset: payload.preset,
        declineReasonNote: payload.note || null,
      },
      {
        onSuccess: () => setDeclineOrderId(null),
      }
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-[#fdf9f3]"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <View className="px-4 gap-4">
        <View className="bg-white rounded-2xl border border-orange-100 p-5">
          <Text className="text-2xl font-black text-gray-900">Dashboard Admin</Text>
          <Text className="text-sm text-gray-600 mt-1">Panoramica operativa in tempo reale del ristorante.</Text>
          <View className="flex-row gap-2 mt-3">
            {[
              { key: 'today', label: 'Oggi' },
              { key: '7d', label: '7 giorni' },
              { key: '30d', label: '30 giorni' },
            ].map((item) => (
              <Pressable
                key={item.key}
                className={`px-3 py-2 rounded-lg border ${timeRange === item.key ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}
                onPress={() => {
                  setTimeRange(item.key as TimeRangeKey);
                  setSelectedHourLabel(null);
                }}
              >
                <Text className={`text-xs font-bold ${timeRange === item.key ? 'text-orange-700' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className={`rounded-2xl border p-4 flex-row items-center gap-3 ${isKitchenOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <FontAwesome name={isKitchenOpen ? 'check-circle' : 'pause-circle'} size={18} color={isKitchenOpen ? '#047857' : '#b91c1c'} />
          <View>
            <Text className={`font-bold ${isKitchenOpen ? 'text-emerald-700' : 'text-red-700'}`}>
              {isKitchenOpen ? 'Disponibilita ordini: APERTA' : 'Disponibilita ordini: CHIUSA'}
            </Text>
            {pausedUntilDate && (
              <Text className="text-xs text-red-700 mt-0.5">
                Pausa fino alle {pausedUntilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            )}
          </View>
        </View>

        {isLoading && !data ? (
          <View className="bg-white rounded-2xl border border-orange-100 p-6 items-center">
            <ActivityIndicator size="small" color="#d97706" />
            <Text className="text-sm text-gray-600 mt-2">Caricamento metriche...</Text>
          </View>
        ) : (
          <View className="gap-3">
            <MetricCard
              title={timeRange === 'today' ? 'Ordini oggi' : `Ordini ${timeRange}`}
              value={String(selectedRangeStats?.ordersCount ?? 0)}
              icon="list"
              selected={selectedMetric === 'orders'}
              onPress={() => setSelectedMetric('orders')}
            />
            <MetricCard
              title="In lavorazione"
              value={String(selectedRangeStats?.pendingCount ?? 0)}
              icon="clock-o"
              selected={selectedMetric === 'pending'}
              onPress={() => setSelectedMetric('pending')}
            />
            <MetricCard
              title={timeRange === 'today' ? 'Incasso oggi' : `Incasso ${timeRange}`}
              value={`EUR ${(selectedRangeStats?.revenue ?? 0).toFixed(2)}`}
              icon="euro"
              selected={selectedMetric === 'revenue'}
              onPress={() => setSelectedMetric('revenue')}
            />
            <MetricCard
              title="Scontrino medio"
              value={`EUR ${(selectedRangeStats?.avgTicket ?? 0).toFixed(2)}`}
              icon="calculator"
              selected={selectedMetric === 'avgTicket'}
              onPress={() => setSelectedMetric('avgTicket')}
            />
            <MetricCard
              title="Prodotti attivi"
              value={String(data?.productsActive ?? 0)}
              icon="cutlery"
              selected={selectedMetric === 'products'}
              onPress={() => setSelectedMetric('products')}
            />

            <View className="bg-white rounded-2xl border border-orange-100 p-4">
              <Text className="text-sm text-gray-500 uppercase font-bold">Deep Dive</Text>
              <Text className="text-lg font-extrabold text-gray-900 mt-1">
                {selectedMetric === 'orders' && 'Andamento ordini per ora'}
                {selectedMetric === 'pending' && 'Carico ordini in lavorazione'}
                {selectedMetric === 'revenue' && 'Performance incasso'}
                {selectedMetric === 'avgTicket' && 'Qualita scontrino medio'}
                {selectedMetric === 'products' && 'Catalogo e copertura menu'}
              </Text>

              {selectedMetric === 'orders' && (
                <View className="mt-3">
                  <View className="flex-row items-end justify-between gap-1">
                    {hourlyOrders.map((item) => {
                      const h = Math.max(6, Math.round((item.count / maxHourlyOrders) * 90));
                      const isSelected = selectedHourLabel === item.label;
                      return (
                        <Pressable key={item.label} className="flex-1 items-center" onPress={() => setSelectedHourLabel(item.label)}>
                          <View className={`w-full max-w-[14px] rounded-t ${isSelected ? 'bg-orange-600' : 'bg-orange-300'}`} style={{ height: h }} />
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text className="text-xs text-gray-600 mt-2">
                    {selectedHourLabel
                      ? `Fascia ${selectedHourLabel}: ${hourlyOrders.find((x) => x.label === selectedHourLabel)?.count ?? 0} ordini`
                      : 'Tocca una barra per vedere il dettaglio della fascia oraria'}
                  </Text>
                </View>
              )}

              {selectedMetric === 'pending' && (
                <Text className="text-sm text-gray-700 mt-3">
                  Ordini in lavorazione nel periodo: <Text className="font-bold">{selectedRangeStats?.pendingCount ?? 0}</Text>. Se supera 8-10 ordini insieme, valuta aumento capacita o stop temporaneo.
                </Text>
              )}

              {selectedMetric === 'revenue' && (
                <Text className="text-sm text-gray-700 mt-3">
                  Incasso periodo: <Text className="font-bold">EUR {(selectedRangeStats?.revenue ?? 0).toFixed(2)}</Text>. Monitora i picchi orari per ottimizzare turni cucina e delivery.
                </Text>
              )}

              {selectedMetric === 'avgTicket' && (
                <Text className="text-sm text-gray-700 mt-3">
                  Scontrino medio: <Text className="font-bold">EUR {(selectedRangeStats?.avgTicket ?? 0).toFixed(2)}</Text>. Per alzarlo: bundle, extra consigliati e upsell bevande/dolci.
                </Text>
              )}

              {selectedMetric === 'products' && (
                <Text className="text-sm text-gray-700 mt-3">
                  Prodotti attivi: <Text className="font-bold">{data?.productsActive ?? 0}</Text>. Mantieni menu snello nelle ore rush per ridurre tempi preparazione.
                </Text>
              )}
            </View>

            <View className="bg-white rounded-2xl border border-orange-100 p-4">
              <Text className="text-sm text-gray-500 uppercase font-bold">Ordini ultimi 7 giorni</Text>
              <View className="mt-4 flex-row items-end justify-between gap-2">
                {(data?.last7DaysOrders ?? []).map((item) => {
                  const barHeight = Math.max(8, Math.round((item.count / maxDailyBar) * 100));
                  return (
                    <View key={item.dayLabel} className="flex-1 items-center">
                      <Text className="text-[11px] font-bold text-gray-700 mb-1">{item.count}</Text>
                      <View className="w-full max-w-[32px] rounded-t-md bg-orange-400" style={{ height: barHeight }} />
                      <Text className="text-[10px] text-gray-500 mt-1">{item.dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="bg-white rounded-2xl border border-orange-100 p-4">
              <Text className="text-sm text-gray-500 uppercase font-bold">Distribuzione stati (7 giorni)</Text>
              <View className="mt-3 gap-2">
                {(data?.statusBreakdown ?? []).map((item) => {
                  const pct = statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0;
                  return (
                    <View key={item.label} className="gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-gray-700">{item.label}</Text>
                        <Text className="text-xs text-gray-600">{item.value} ({pct}%)</Text>
                      </View>
                      <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="bg-white rounded-2xl border border-orange-100 p-4">
              <Text className="text-sm text-gray-500 uppercase font-bold">Previsione prossime 2 ore</Text>
              <View className="gap-2 mt-3">
                {nextTwoHoursForecast.map((slot) => (
                  <View
                    key={slot.label}
                    className={`rounded-xl border p-3 ${
                      slot.risk === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : slot.risk === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <Text className="font-bold text-gray-900">{slot.label}</Text>
                    <Text className="text-xs text-gray-700 mt-1">
                      Previsti: {slot.expectedTotal} ordini ({slot.expectedDelivery} delivery / {slot.expectedNonDelivery} altri)
                    </Text>
                    <Text className="text-xs text-gray-700">
                      Capacita: {slot.capacityTotal} totali, {slot.capacityDelivery} delivery
                    </Text>
                    <Text className={`text-xs font-bold mt-1 ${slot.risk === 'critical' ? 'text-red-700' : slot.risk === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {slot.risk === 'critical' ? 'Rischio alto saturazione' : slot.risk === 'warning' ? 'Rischio medio' : 'Capacita sotto controllo'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="bg-white rounded-2xl border border-orange-100 p-4">
              <Text className="text-sm text-gray-500 uppercase font-bold">Gestione ordini rapida</Text>
              <View className="gap-2 mt-3">
                {actionableOrders.length === 0 ? (
                  <Text className="text-sm text-gray-500">Nessun ordine attivo da gestire.</Text>
                ) : (
                  actionableOrders.map((order) => {
                    const nextStatus = getNextStatus(order.status);
                    return (
                      <View key={order.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <View className="flex-row items-center justify-between">
                          <View>
                            <Text className="font-extrabold text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</Text>
                            <Text className="text-xs text-gray-500">
                              {order.customer_name || 'Cliente'} • €{order.total_amount.toFixed(2)}
                            </Text>
                          </View>
                          <Text className="text-[11px] font-bold uppercase text-orange-700">{order.status}</Text>
                        </View>
                        {(order.decline_reason_preset || order.decline_reason_note) && (
                          <View className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                            <Text className="text-[10px] text-red-700 font-bold uppercase">{order.decline_reason_preset || 'Rifiutato'}</Text>
                            {order.decline_reason_note ? <Text className="text-[11px] text-red-700">{order.decline_reason_note}</Text> : null}
                          </View>
                        )}
                        {(nextStatus || order.status !== 'cancelled') ? (
                          <View className="flex-row gap-2 mt-3">
                            {nextStatus ? (
                              <Pressable
                                className="flex-1 h-9 rounded-lg bg-emerald-600 items-center justify-center"
                                onPress={() =>
                                  updateOrderStatus.mutate({
                                    orderId: order.id,
                                    status: nextStatus,
                                  })
                                }
                              >
                                <Text className="text-white text-xs font-bold">
                                  {order.status === 'pending'
                                    ? 'Accetta'
                                    : order.status === 'preparing'
                                    ? 'Segna pronto'
                                    : 'Segna consegnato'}
                                </Text>
                              </Pressable>
                            ) : null}
                            {order.status !== 'cancelled' && order.status !== 'delivered' ? (
                              <Pressable
                                className="flex-1 h-9 rounded-lg bg-red-600 items-center justify-center"
                                onPress={() => setDeclineOrderId(order.id)}
                              >
                                <Text className="text-white text-xs font-bold">Rifiuta</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        )}
      </View>
      <DeclineReasonModal
        visible={Boolean(declineOrderId)}
        onClose={() => setDeclineOrderId(null)}
        onConfirm={handleDeclineOrder}
        isSubmitting={updateOrderStatus.isPending}
      />
    </ScrollView>
  );
}

function MetricCard({
  title,
  value,
  icon,
  selected,
  onPress,
}: {
  title: string;
  value: string;
  icon: ComponentProps<typeof FontAwesome>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`rounded-2xl border p-4 flex-row items-center justify-between ${selected ? 'bg-orange-50 border-orange-200' : 'bg-white border-orange-100'}`}
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="text-xs text-gray-500 uppercase font-bold">{title}</Text>
        <Text className="text-2xl font-black text-gray-900 mt-1">{value}</Text>
      </View>
      <View className={`w-10 h-10 rounded-full items-center justify-center ${selected ? 'bg-orange-200' : 'bg-orange-100'}`}>
        <FontAwesome name={icon} size={16} color="#c2410c" />
      </View>
    </Pressable>
  );
}
