/**
 * KitchenOrderCard Component
 * Displays order details in kitchen dashboard
 */

import type { KitchenOrder } from '@/lib/hooks/useKitchenOrders';
import { DeclineReasonModal } from '@/components/features/orders/DeclineReasonModal';
import { useUpdateOrderStatus } from '@/lib/hooks/useUpdateOrderStatus';
import type { Database } from '@/types/database.types.generated';
import { FontAwesome } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';
import { useState } from 'react';

type OrderStatus = Database['public']['Enums']['order_status'];

interface KitchenOrderCardProps {
  order: KitchenOrder;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    buttonBg: string;
    buttonText: string;
    totalColor: string;
    nextStatus?: OrderStatus;
  }
> = {
  pending: {
    label: 'Nuovo',
    color: 'text-amber-800',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    buttonBg: 'bg-amber-500',
    buttonText: 'text-white',
    totalColor: 'text-amber-600',
    nextStatus: 'preparing',
  },
  preparing: {
    label: 'In Preparazione',
    color: 'text-sky-800',
    bgColor: 'bg-sky-100',
    borderColor: 'border-sky-300',
    buttonBg: 'bg-sky-500',
    buttonText: 'text-white',
    totalColor: 'text-sky-600',
    nextStatus: 'ready',
  },
  ready: {
    label: 'Pronto',
    color: 'text-emerald-800',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    buttonBg: 'bg-emerald-500',
    buttonText: 'text-white',
    totalColor: 'text-emerald-600',
    nextStatus: 'delivered',
  },
  delivered: {
    label: 'Consegnato',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    buttonBg: 'bg-slate-500',
    buttonText: 'text-white',
    totalColor: 'text-slate-600',
  },
  cancelled: {
    label: 'Annullato',
    color: 'text-rose-800',
    bgColor: 'bg-rose-100',
    borderColor: 'border-rose-300',
    buttonBg: 'bg-rose-600',
    buttonText: 'text-white',
    totalColor: 'text-rose-600',
  },
};

export function KitchenOrderCard({ order }: KitchenOrderCardProps) {
  const updateStatus = useUpdateOrderStatus();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const statusConfig = STATUS_CONFIG[order.status];

  const handleNextStatus = () => {
    if (!statusConfig.nextStatus) return;

    updateStatus.mutate(
      {
        orderId: order.id,
        status: statusConfig.nextStatus,
      },
      {
        onError: (error) => {
          Alert.alert(
            'Aggiornamento fallito',
            error instanceof Error ? error.message : 'Impossibile aggiornare lo stato dell\'ordine.'
          );
        },
      }
    );
  };

  const handleDeclineOrder = (payload: { preset: string; note: string }) => {
    updateStatus.mutate(
      {
        orderId: order.id,
        status: 'cancelled',
        declineReasonPreset: payload.preset,
        declineReasonNote: payload.note || null,
      },
      {
        onSuccess: () => setShowDeclineModal(false),
      }
    );
  };

  // Calculate order age
  const orderAge = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000 / 60);
  const isUrgent = orderAge > 10;
  const isOld = orderAge > 5;

  return (
    <View className={`bg-card rounded-2xl p-5 border-2 ${isUrgent ? 'border-red-500' : isOld ? 'border-[#e7b577]' : statusConfig.borderColor} shadow-lg`}>
      {/* Header */}
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-foreground font-extrabold text-2xl">
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            {isUrgent && <FontAwesome name="exclamation-triangle" size={16} color="#dc2626" />}
          </View>
          <Text className="text-muted-foreground text-sm">
            {orderAge < 1 ? 'Appena arrivato' : `${orderAge} min fa`}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View className={`${statusConfig.bgColor} px-4 py-2 rounded-xl border ${statusConfig.borderColor}`}>
            <Text className={`${statusConfig.color} font-bold text-sm`}>
              {statusConfig.label}
            </Text>
          </View>

          {/* Cancel Button - Moved to top right */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Pressable
              className="bg-destructive/10 p-2 rounded-xl border border-destructive/20 active:bg-destructive/20"
              onPress={() => setShowDeclineModal(true)}
              disabled={updateStatus.isPending}
            >
              <FontAwesome name="times" size={12} color="#dc2626" />
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
                  <View className="flex-row items-center gap-1 mt-1">
                    <FontAwesome name="sticky-note-o" size={11} color="#6b7280" />
                    <Text className="text-muted-foreground text-sm">{item.notes}</Text>
                  </View>
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
          <View className="flex-row items-center gap-1">
            <FontAwesome name="comment-o" size={11} color="#854d0e" />
            <Text className="text-yellow-800 text-sm">{order.notes}</Text>
          </View>
        </View>
      )}

      {(order.decline_reason_preset || order.decline_reason_note) && (
        <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <Text className="text-red-700 text-xs font-extrabold uppercase">Motivo rifiuto</Text>
          {order.decline_reason_preset ? (
            <Text className="text-red-800 text-sm font-bold mt-1">{order.decline_reason_preset}</Text>
          ) : null}
          {order.decline_reason_note ? (
            <Text className="text-red-700 text-xs mt-1">{order.decline_reason_note}</Text>
          ) : null}
        </View>
      )}

      {/* Total */}
      <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-border">
        <Text className="text-foreground font-bold text-lg">Totale</Text>
        <Text className={`${statusConfig.totalColor} font-extrabold text-2xl`}>
          €{order.total_amount.toFixed(2)}
        </Text>
      </View>

      {/* Action Buttons */}
      <View>
        {statusConfig.nextStatus && (
          <Pressable
            className={`${statusConfig.buttonBg} rounded-xl p-4 items-center active:opacity-80 shadow-md`}
            onPress={handleNextStatus}
            disabled={updateStatus.isPending}
            style={{ opacity: updateStatus.isPending ? 0.5 : 1 }}
          >
            <Text className={`${statusConfig.buttonText} font-bold text-lg`}>
              {updateStatus.isPending ? 'Aggiornamento...' :
                order.status === 'pending' ? 'Accetta ordine' :
                  order.status === 'preparing' ? 'Segna come Pronto' :
                    order.status === 'ready' ? 'Segna come Consegnato' : 'Avanti'}
            </Text>
          </Pressable>
        )}
      </View>
      <DeclineReasonModal
        visible={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        onConfirm={handleDeclineOrder}
        isSubmitting={updateStatus.isPending}
      />
    </View>
  );
}
