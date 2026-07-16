import { useAdminOrders } from '@/lib/hooks/useAdminOrders';
import { useOrders } from '@/lib/hooks/useOrders';
import type { AdminOrder } from '@/lib/hooks/useAdminOrders';
import type { OrderWithItems } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/stores/AuthContext';
import type { Database } from '@/types/database.types.generated';
import { getOrderDisplayCode } from '@/lib/utils/orderDisplayCode';
import { SkeletonList, SkeletonOrderCard } from '@/components/ui/Skeleton';
import { FontAwesome } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OrderStatus = Database['public']['Enums']['order_status'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Nuovo',
  preparing: 'In preparazione',
  ready: 'Pronto',
  delivered: 'Completato',
  cancelled: 'Annullato',
};

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  preparing: { bg: 'bg-sky-100', text: 'text-sky-700' },
  ready: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  delivered: { bg: 'bg-slate-100', text: 'text-slate-700' },
  cancelled: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

const ADMIN_FILTERS: { label: string; statuses?: OrderStatus[] }[] = [
  { label: 'Tutti' },
  { label: 'In corso', statuses: ['pending', 'preparing', 'ready'] },
  { label: 'Completati', statuses: ['delivered'] },
  { label: 'Annullati', statuses: ['cancelled'] },
];

function formatOrderDate(createdAt: string): string {
  const date = new Date(createdAt);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatItems(order: AdminOrder | OrderWithItems): string {
  return order.order_items
    .map((item) => `${item.quantity}x ${item.product?.name ?? 'Prodotto'}`)
    .join(' • ');
}

function OrderCard({
  order,
  onReorder,
  onTrack,
}: {
  order: AdminOrder | OrderWithItems;
  onReorder?: () => void;
  onTrack?: () => void;
}) {
  const status = order.status as OrderStatus;
  const colors = STATUS_COLORS[status];

  return (
    <View className="rounded-xl bg-[#fffaf5] border border-orange-100 p-3 gap-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-bold text-gray-900">
            {getOrderDisplayCode(order)}
          </Text>
          <Text className="text-xs text-gray-500">{formatOrderDate(order.created_at)}</Text>
          {'customer_name' in order && order.customer_name ? (
            <Text className="text-xs text-gray-600 mt-0.5">{order.customer_name}</Text>
          ) : null}
        </View>
        <View className={`px-2 py-1 rounded-full ${colors.bg}`}>
          <Text className={`text-[10px] font-bold ${colors.text}`}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      {order.order_items.length > 0 ? (
        <Text className="text-xs text-gray-600">{formatItems(order)}</Text>
      ) : null}

      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-[#d4451a]">
          €{order.total_amount.toFixed(2)}
        </Text>
        {(onReorder || onTrack) && (
          <View className="flex-row gap-2">
            {onReorder ? (
              <Pressable
                onPress={onReorder}
                className="h-9 px-3 rounded-lg bg-orange-100 items-center justify-center active:opacity-90"
              >
                <Text className="text-xs font-bold text-orange-700">Riordina</Text>
              </Pressable>
            ) : null}
            {onTrack ? (
              <Pressable
                onPress={onTrack}
                className="h-9 px-3 rounded-lg bg-[#1f2937] items-center justify-center active:opacity-90 flex-row gap-1"
              >
                <FontAwesome name="map-marker" size={12} color="white" />
                <Text className="text-xs font-bold text-white">Track</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, profile, isAdmin } = useAuth();
  const [filterIndex, setFilterIndex] = useState(0);
  const selectedFilter = ADMIN_FILTERS[filterIndex];

  const adminQuery = useAdminOrders({
    statuses: selectedFilter.statuses,
    enabled: isAdmin,
  });

  const customerQuery = useOrders({
    limit: 50,
    enabled: isAuthenticated && !isAdmin,
  });

  const activeQuery = isAdmin ? adminQuery : customerQuery;
  const orders = activeQuery.data ?? [];
  const isLoading = activeQuery.isLoading;
  const isRefetching = activeQuery.isRefetching;
  const showSkeleton = isLoading && orders.length === 0;

  const handleReorder = (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    const label = order ? getOrderDisplayCode(order) : getOrderDisplayCode({ id: orderId, display_code: null });
    Alert.alert('Riordina', `Vuoi riordinare ${label}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Riordina', onPress: () => router.push('/(tabs)/menu') },
    ]);
  };

  const headerSubtitle = useMemo(() => {
    if (isAdmin) return 'Storico ordini del ristorante in ordine cronologico.';
    return 'I tuoi ultimi ordini artigianali.';
  }, [isAdmin]);

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          className="flex-1 bg-[#fdf9f3]"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        >
          <View className="px-4 gap-4">
            <View className="bg-white rounded-2xl border border-orange-100 p-5 gap-3">
              <Text className="text-2xl font-black text-gray-900">Recent Orders</Text>
              <Text className="text-sm text-gray-600">
                Accedi per vedere i tuoi ordini, tracciare la consegna e riordinare in un tap.
              </Text>
              <Pressable
                onPress={() => router.push('/login')}
                className="h-12 rounded-xl bg-[#d4451a] items-center justify-center active:opacity-90"
              >
                <Text className="text-white font-bold">Accedi</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </>
    );
  }

  // The list is virtualized (FlatList as the page scroller); the white
  // rounded container is rebuilt from header/row/footer segments so up to
  // 50 order cards don't all mount at once inside a plain ScrollView.
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        className="flex-1 bg-[#fdf9f3]"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void activeQuery.refetch()}
          />
        }
        data={showSkeleton ? [] : orders}
        keyExtractor={(order) => order.id}
        renderItem={({ item: order }) => (
          <View className="bg-white border-x border-orange-100 px-4 pb-3">
            <OrderCard
              order={order}
              onReorder={!isAdmin ? () => handleReorder(order.id) : undefined}
              onTrack={!isAdmin ? () => router.push('/order-tracking') : undefined}
            />
          </View>
        )}
        ListHeaderComponent={
          <View className="gap-4">
            <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-1">
              <Text className="text-xs font-bold uppercase tracking-wider text-orange-700">
                {isAdmin ? 'Admin' : 'Bentornato'}
              </Text>
              <Text className="text-2xl font-black text-gray-900">
                {isAdmin ? 'Storico ordini' : profile?.full_name || 'Cliente Ambrosia'}
              </Text>
              <Text className="text-gray-600 text-sm">{headerSubtitle}</Text>
            </View>

            {isAdmin && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {ADMIN_FILTERS.map((filter, index) => (
                    <Pressable
                      key={filter.label}
                      className={`px-4 py-2 rounded-xl ${
                        filterIndex === index ? 'bg-[#d4451a]' : 'bg-white border border-orange-100'
                      }`}
                      onPress={() => setFilterIndex(index)}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          filterIndex === index ? 'text-white' : 'text-gray-600'
                        }`}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            <View className="bg-white rounded-t-2xl border-x border-t border-orange-100 p-4 pb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-extrabold text-gray-900">
                  {isAdmin ? `Ordini (${orders.length})` : 'Ordini recenti'}
                </Text>
                {!isAdmin && (
                  <Pressable onPress={() => router.push('/order-tracking')}>
                    <Text className="text-orange-700 text-xs font-bold">Tracking live →</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="bg-white border-x border-orange-100 px-4 pb-3">
            {showSkeleton ? (
              <SkeletonList count={4} renderItem={() => <SkeletonOrderCard />} />
            ) : (
              <View className="py-8 items-center">
                <FontAwesome name="inbox" size={32} color="#d1d5db" />
                <Text className="text-sm text-gray-500 mt-2 text-center">
                  {isAdmin
                    ? 'Nessun ordine in questa categoria.'
                    : 'Non hai ancora effettuato ordini.'}
                </Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          <View className="bg-white rounded-b-2xl border-x border-b border-orange-100 h-3" />
        }
      />
    </>
  );
}
