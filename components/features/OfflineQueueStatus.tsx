/**
 * OfflineQueueStatus Component
 * Display and manage pending offline orders
 */

import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface OfflineQueueStatusProps {
  visible?: boolean;
  onClose?: () => void;
}

/**
 * Full offline queue management view
 */
export function OfflineQueueStatus({
  visible = true,
  onClose,
}: OfflineQueueStatusProps): ReactNode {
  const {
    pendingOrders,
    isOnline,
    isSyncing,
    pendingCount,
    forceSync,
    retryOrder,
    removeFromQueue,
    clearQueue,
  } = useOfflineQueue();

  if (!visible) return null;

  // Format date for display
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get order type icon
  const getOrderTypeIcon = (type: string): string => {
    switch (type) {
      case 'eat_in':
        return '🍽️';
      case 'take_away':
        return '🛍️';
      case 'delivery':
        return '🛵';
      default:
        return '📦';
    }
  };

  // Calculate total for an order
  const calculateOrderTotal = (items: { product: { price: number }; quantity: number }[]): number => {
    return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="p-6 border-b border-border bg-card">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">📤</Text>
            <View>
              <Text className="text-foreground font-extrabold text-xl">
                Ordini in Coda
              </Text>
              <Text className="text-muted-foreground text-sm">
                {isOnline ? 'Pronto per la sincronizzazione' : 'Sei offline'}
              </Text>
            </View>
          </View>
          {onClose && (
            <TouchableOpacity
              className="bg-secondary rounded-full p-2"
              onPress={onClose}
            >
              <Text className="text-xl">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Banner */}
      <View
        className={`px-6 py-3 flex-row items-center justify-between ${
          isOnline ? 'bg-success/10' : 'bg-amber-500/10'
        }`}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">{isOnline ? '🟢' : '🔴'}</Text>
          <Text
            className={`font-medium ${
              isOnline ? 'text-success' : 'text-amber-500'
            }`}
          >
            {isOnline
              ? `Connesso - ${pendingCount} ordini in attesa`
              : 'Offline - Gli ordini verranno sincronizzati'}
          </Text>
        </View>
        {isSyncing && (
          <ActivityIndicator size="small" className="text-primary" />
        )}
      </View>

      {/* Actions */}
      {pendingCount > 0 && (
        <View className="flex-row gap-3 p-4 border-b border-border">
          <Pressable
            className={`flex-1 bg-primary rounded-xl py-3 items-center active:opacity-80 ${
              !isOnline || isSyncing ? 'opacity-50' : ''
            }`}
            onPress={forceSync}
            disabled={!isOnline || isSyncing}
          >
            <Text className="text-primary-foreground font-bold">
              {isSyncing ? 'Sincronizzazione...' : 'Sincronizza Ora'}
            </Text>
          </Pressable>
          <Pressable
            className="bg-secondary rounded-xl py-3 px-4 items-center active:opacity-80"
            onPress={() => {
              // Clear all orders with confirmation
              clearQueue();
            }}
          >
            <Text className="text-foreground font-bold">Svuota</Text>
          </Pressable>
        </View>
      )}

      {/* Orders List */}
      {pendingOrders.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-6xl mb-4">✅</Text>
          <Text className="text-foreground font-extrabold text-xl text-center mb-2">
            Tutto sincronizzato!
          </Text>
          <Text className="text-muted-foreground text-center">
            Non ci sono ordini in attesa di sincronizzazione
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
          showsVerticalScrollIndicator={false}
        >
          {pendingOrders.map((order) => {
            const total = calculateOrderTotal(order.items);

            return (
              <View
                key={order.id}
                className="bg-card rounded-xl p-4 border border-border"
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-2xl">{getOrderTypeIcon(order.orderType)}</Text>
                    <View>
                      <Text className="text-foreground font-bold">
                        Ordine #{order.id.slice(-6)}
                      </Text>
                      <Text className="text-muted-foreground text-sm">
                        {formatDate(order.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-primary font-extrabold text-xl">
                      €{total.toFixed(2)}
                    </Text>
                    {order.syncAttempts > 0 && (
                      <Text className="text-amber-500 text-xs">
                        Tentativi: {order.syncAttempts}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Order Items Summary */}
                <View className="bg-secondary/20 rounded-lg p-3 mb-3">
                  <Text className="text-muted-foreground text-sm mb-1">
                    Prodotti ({order.items.length}):
                  </Text>
                  <Text className="text-foreground" numberOfLines={2}>
                    {order.items
                      .map((item) => `${item.quantity}x ${item.product.name}`)
                      .join(', ')}
                  </Text>
                </View>

                {/* Customer Info */}
                {(order.customerName || order.tableNumber) && (
                  <View className="flex-row items-center gap-2 mb-3">
                    <Text className="text-muted-foreground text-sm">
                      {order.orderType === 'eat_in'
                        ? `Tavolo: ${order.tableNumber}`
                        : order.customerName || ''}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View className="flex-row gap-2">
                  <Pressable
                    className={`flex-1 bg-success/10 rounded-lg py-2 items-center active:opacity-80 ${
                      !isOnline ? 'opacity-50' : ''
                    }`}
                    onPress={() => retryOrder(order.id)}
                    disabled={!isOnline || isSyncing}
                  >
                    <Text className="text-success font-bold text-sm">Riprova</Text>
                  </Pressable>
                  <Pressable
                    className="bg-destructive/10 rounded-lg py-2 px-4 items-center active:opacity-80"
                    onPress={() => removeFromQueue(order.id)}
                  >
                    <Text className="text-destructive font-bold text-sm">Rimuovi</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Compact offline indicator for header
 */
export function OfflineQueueIndicator(): ReactNode {
  const { isOnline, pendingCount, isSyncing } = useOfflineQueue();

  if (isOnline && pendingCount === 0) return null;

  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full ${
        pendingCount > 0 ? 'bg-amber-500' : 'bg-red-500'
      }`}
    >
      <Text className="text-white text-sm">
        {pendingCount > 0 ? `📤 ${pendingCount}` : '📡'}
      </Text>
      {isSyncing && (
        <ActivityIndicator size="small" color="#FFFFFF" />
      )}
    </View>
  );
}

/**
 * Badge showing pending orders count
 */
export function OfflineQueueBadge(): ReactNode {
  const { pendingCount } = useOfflineQueue();

  if (pendingCount === 0) return null;

  return (
    <View className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full items-center justify-center">
      <Text className="text-white text-xs font-bold">{pendingCount}</Text>
    </View>
  );
}