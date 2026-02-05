/**
 * KitchenOrderCard Component
 * Displays order details in kitchen dashboard
 */

import type { KitchenOrder } from '@/lib/hooks/useKitchenOrders';
import { useUpdateOrderStatus } from '@/lib/hooks/useUpdateOrderStatus';
import type { Database } from '@/types/database.types.generated';
import { Alert, Pressable, Text, View } from 'react-native';

type OrderStatus = Database['public']['Enums']['order_status'];

interface KitchenOrderCardProps {
  order: KitchenOrder;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; nextStatus?: OrderStatus }> = {
  pending: {
    label: 'Nuovo',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    nextStatus: 'preparing',
  },
  preparing: {
    label: 'In Preparazione',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    nextStatus: 'ready',
  },
  ready: {
    label: 'Pronto',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    nextStatus: 'delivered',
  },
  delivered: {
    label: 'Consegnato',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  cancelled: {
    label: 'Annullato',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};

export function KitchenOrderCard({ order }: KitchenOrderCardProps) {
  const updateStatus = useUpdateOrderStatus();
  const statusConfig = STATUS_CONFIG[order.status];

  const handleNextStatus = () => {
    if (statusConfig.nextStatus) {
      updateStatus.mutate({
        orderId: order.id,
        status: statusConfig.nextStatus,
      });
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Annulla Ordine',
      'Sei sicuro di voler annullare questo ordine? Questa azione non può essere annullata.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sì, Annulla',
          style: 'destructive',
          onPress: () => {
            updateStatus.mutate({
              orderId: order.id,
              status: 'cancelled',
            });
          },
        },
      ]
    );
  };

  // Calculate order age
  const orderAge = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000 / 60);
  const isUrgent = orderAge > 10;
  const isOld = orderAge > 5;

  return (
    <View className={`bg-card rounded-2xl p-5 border-2 ${isUrgent ? 'border-red-500' : isOld ? 'border-orange-400' : 'border-border'} shadow-lg`}>
      {/* Header */}
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-foreground font-extrabold text-2xl">
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            {isUrgent && <Text className="text-3xl">⚠️</Text>}
          </View>
          <Text className="text-muted-foreground text-sm">
            {orderAge < 1 ? 'Appena arrivato' : `${orderAge} min fa`}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View className={`${statusConfig.bgColor} px-4 py-2 rounded-xl`}>
            <Text className={`${statusConfig.color} font-bold text-sm`}>
              {statusConfig.label}
            </Text>
          </View>

          {/* Cancel Button - Moved to top right */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Pressable
              className="bg-destructive/10 p-2 rounded-xl border border-destructive/20 active:bg-destructive/20"
              onPress={handleCancelOrder}
              disabled={updateStatus.isPending}
            >
              <Text className="text-destructive font-bold text-xs">✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Order Items */}
      <View className="bg-secondary/30 rounded-xl p-4 mb-4">
        {order.order_items.map((item, index) => (
          <View key={item.id} className={index > 0 ? 'mt-3 pt-3 border-t border-border' : ''}>
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-foreground font-bold text-lg">
                  {item.quantity}x {item.product.name}
                </Text>
                {item.notes && (
                  <Text className="text-muted-foreground text-sm mt-1">
                    📝 {item.notes}
                  </Text>
                )}
              </View>
              <Text className="text-foreground font-semibold text-base ml-2">
                €{item.total_price.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Order Notes */}
      {order.notes && (
        <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
          <Text className="text-yellow-800 text-sm">
            💬 {order.notes}
          </Text>
        </View>
      )}

      {/* Total */}
      <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-border">
        <Text className="text-foreground font-bold text-lg">Totale</Text>
        <Text className="text-primary font-extrabold text-2xl">
          €{order.total_amount.toFixed(2)}
        </Text>
      </View>

      {/* Action Buttons */}
      <View>
        {statusConfig.nextStatus && (
          <Pressable
            className="bg-primary rounded-xl p-4 items-center active:opacity-80 shadow-md"
            onPress={handleNextStatus}
            disabled={updateStatus.isPending}
            style={{ opacity: updateStatus.isPending ? 0.5 : 1 }}
          >
            <Text className="text-primary-foreground font-bold text-lg">
              {updateStatus.isPending ? 'Aggiornamento...' :
                order.status === 'pending' ? '▶ Inizia Preparazione' :
                  order.status === 'preparing' ? '✓ Segna come Pronto' :
                    order.status === 'ready' ? '📦 Segna come Consegnato' : 'Avanti'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
