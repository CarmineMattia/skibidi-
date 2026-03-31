import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OrderType = 'eat_in' | 'take_away' | 'delivery';

function normalizeOrderType(value?: string): OrderType {
  if (value === 'eat_in' || value === 'take_away' || value === 'delivery') return value;
  return 'delivery';
}

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderType: rawOrderType, orderId } = useLocalSearchParams<{
    orderType?: string;
    orderId?: string;
  }>();
  const orderType = normalizeOrderType(rawOrderType);
  const estimatedLabel = orderType === 'delivery' ? 'Estimated Arrival' : 'Estimated Ready';
  const orderRef = (orderId || 'AMB-9821').slice(0, 8).toUpperCase();
  let supportTitle = 'Live Tracking';
  let supportDescription = '4.2 miles away';
  if (orderType === 'eat_in') {
    supportTitle = 'Table Service';
    supportDescription = 'We will notify you as soon as your dishes are served at the table.';
  } else if (orderType === 'take_away') {
    supportTitle = 'Pickup Counter';
    supportDescription = 'We will notify you as soon as your order is ready for pickup.';
  }

  let summaryText = `Order #${orderRef} is being prepared with care.`;
  if (orderType === 'eat_in') {
    summaryText = `Order #${orderRef} is being prepared with care for table service.`;
  } else if (orderType === 'take_away') {
    summaryText = `Order #${orderRef} is being prepared for pickup.`;
  }
  let trackingSteps: { key: string; label: string; icon: 'check-circle' | 'cutlery' | 'bell' | 'shopping-bag' | 'motorcycle' | 'home'; done: boolean }[];
  if (orderType === 'eat_in') {
    trackingSteps = [
      { key: 'confirmed', label: 'Confirmed', icon: 'check-circle', done: true },
      { key: 'preparing', label: 'Preparing', icon: 'cutlery', done: true },
      { key: 'served', label: 'Served', icon: 'bell', done: false },
    ];
  } else if (orderType === 'take_away') {
    trackingSteps = [
      { key: 'confirmed', label: 'Confirmed', icon: 'check-circle', done: true },
      { key: 'preparing', label: 'Preparing', icon: 'cutlery', done: true },
      { key: 'pickup', label: 'Ready for Pickup', icon: 'shopping-bag', done: false },
    ];
  } else {
    trackingSteps = [
      { key: 'confirmed', label: 'Confirmed', icon: 'check-circle', done: true },
      { key: 'preparing', label: 'Preparing', icon: 'cutlery', done: true },
      { key: 'delivery', label: 'Out for Delivery', icon: 'motorcycle', done: false },
      { key: 'delivered', label: 'Delivered', icon: 'home', done: false },
    ];
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#fdf9f3]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      >
        <View className="px-4 gap-3.5">
          <View className="bg-white rounded-2xl border border-orange-100 px-4 py-3.5 gap-2.5">
            <Text className="text-xs font-bold uppercase tracking-wider text-orange-700">
              Ambrosia | Track your order
            </Text>
            <Text className="text-gray-900 text-[13px]">{estimatedLabel}</Text>
            <Text className="text-[46px] leading-[48px] font-black text-gray-900">12:45</Text>
            <Text className="text-gray-600 text-sm leading-5">{summaryText}</Text>
            <View className="self-start bg-orange-100 rounded-full px-3 py-1.5">
              <Text className="text-orange-700 text-xs font-bold">🔥 In the Hearth</Text>
            </View>
          </View>

          <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-2.5">
            {trackingSteps.map((step, index) => {
              const isLast = index === trackingSteps.length - 1;
              return (
                <View key={step.key} className="flex-row gap-3">
                  <View className="items-center">
                    <View
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        step.done ? 'bg-[#d4451a]' : 'bg-orange-100'
                      }`}
                    >
                      <FontAwesome
                        name={step.icon}
                        size={15}
                        color={step.done ? '#fff' : '#9a3412'}
                      />
                    </View>
                    {!isLast && (
                      <View
                        className={`w-[2px] h-10 ${step.done ? 'bg-[#d4451a]' : 'bg-orange-200'}`}
                      />
                    )}
                  </View>
                  <View className="pt-1">
                    <Text className="text-gray-900 font-bold text-base">{step.label}</Text>
                    <Text className="text-xs text-gray-500">
                      {step.done ? 'Completed' : 'Waiting for next step'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {orderType === 'delivery' ? (
            <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-3">
              <Text className="text-xl font-extrabold text-gray-900">{supportTitle}</Text>
              <Text className="text-sm text-gray-600">{supportDescription}</Text>
              <View className="flex-row gap-2">
                <Pressable className="flex-1 h-11 rounded-xl bg-[#d4451a] items-center justify-center active:opacity-90">
                  <Text className="text-white font-bold">📞 Call</Text>
                </Pressable>
                <Pressable className="flex-1 h-11 rounded-xl bg-orange-100 items-center justify-center active:opacity-90">
                  <Text className="text-orange-700 font-bold">💬 Chat</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-2">
              <Text className="text-xl font-extrabold text-gray-900">{supportTitle}</Text>
              <Text className="text-sm text-gray-600">{supportDescription}</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/menu')}
            className="h-12 rounded-xl bg-[#1f2937] items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-bold">New Order</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
