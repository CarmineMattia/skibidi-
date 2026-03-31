import { FontAwesome } from '@expo/vector-icons';
import type { HomeRecentOrder } from '@/components/features/home/types';
import { Pressable, Text, View } from 'react-native';

interface HomeHistoryPreviewProps {
  orders: HomeRecentOrder[];
  onOpenAll: () => void;
  onOpenOrder: (orderId: string) => void;
  onReorder: (orderId: string) => void;
}

export function HomeHistoryPreview({
  orders,
  onOpenAll,
  onOpenOrder,
  onReorder,
}: HomeHistoryPreviewProps) {
  return (
    <View>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-extrabold text-gray-900">📦 Storico Rapido</Text>
        <Pressable onPress={onOpenAll}>
          <Text className="text-orange-600 text-xs font-bold">Tutti →</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        {orders.map((order) => (
          <Pressable
            key={order.id}
            className="bg-white rounded-lg border border-gray-200 p-3 active:bg-gray-50"
            onPress={() => onOpenOrder(order.id)}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-bold text-gray-900 text-sm">{order.id}</Text>
                <Text className="text-gray-500 text-[10px]">{order.date}</Text>
              </View>
              <View className="items-end">
                <Text className="text-green-600 text-[10px] font-bold bg-green-100 px-2 py-0.5 rounded-full">
                  {order.status}
                </Text>
                <Text className="text-orange-600 font-bold text-sm">€{order.total.toFixed(2)}</Text>
              </View>
            </View>
            <View className="flex-row gap-2 mt-2 pt-2 border-t border-gray-200">
              <Pressable
                className="flex-1 bg-orange-100 rounded py-1.5 flex-row items-center justify-center gap-1"
                onPress={() => onReorder(order.id)}
              >
                <FontAwesome name="repeat" size={12} color="#f97316" />
                <Text className="text-orange-600 text-[10px] font-bold">Riordina</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
