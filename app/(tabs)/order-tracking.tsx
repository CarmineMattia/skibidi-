import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/api/supabase';
import { useOrderAlertSound } from '@/lib/hooks/useOrderAlertSound';
import { useOrder } from '@/lib/hooks/useOrders';
import {
  getEstimatedReadyTime,
  getTrackingBadge,
  getTrackingSteps,
  getTrackingSummary,
  normalizeOrderType,
} from '@/lib/utils/orderTracking';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orderType: rawOrderType, orderId } = useLocalSearchParams<{
    orderType?: string;
    orderId?: string;
  }>();
  const orderIdParam = typeof orderId === 'string' ? orderId : undefined;
  const { data: orderData } = useOrder(orderIdParam ?? '');
  const { playAlert } = useOrderAlertSound();
  const lastStatusRef = useRef<string | null>(null);

  const orderType = normalizeOrderType(orderData?.order_type ?? rawOrderType);
  const orderRef = (orderIdParam || orderData?.id || 'AMB-9821').slice(0, 8).toUpperCase();
  const trackedStatus = orderData?.status ?? null;
  const trackedDeclinePreset = orderData?.decline_reason_preset ?? null;
  const trackedDeclineNote = orderData?.decline_reason_note ?? null;

  const estimatedLabel = orderType === 'delivery' ? 'Arrivo stimato' : 'Pronto stimato';
  const estimatedTime = getEstimatedReadyTime(orderData?.created_at);
  const trackingSteps = getTrackingSteps(orderType, trackedStatus);
  const statusBadge = getTrackingBadge(orderType, trackedStatus);
  const summaryText = getTrackingSummary(orderRef, orderType, trackedStatus);

  let supportTitle = 'Tracking live';
  let supportDescription = 'Il rider è in viaggio verso di te.';
  if (orderType === 'eat_in') {
    supportTitle = 'Servizio al tavolo';
    supportDescription = 'Ti avviseremo appena i piatti saranno serviti al tavolo.';
  } else if (orderType === 'take_away') {
    supportTitle = 'Banco ritiro';
    supportDescription = 'Ti avviseremo appena l\'ordine sarà pronto per il ritiro.';
  }

  useEffect(() => {
    if (!orderIdParam) return;

    const channel = supabase
      .channel(`order-tracking-${orderIdParam}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderIdParam}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string } | null)?.status ?? null;
          const prevStatus = (payload.old as { status?: string } | null)?.status ?? null;

          void queryClient.invalidateQueries({ queryKey: ['orders', orderIdParam] });
          void queryClient.invalidateQueries({ queryKey: ['orders'] });

          if (nextStatus === 'ready' && prevStatus !== 'ready') {
            void playAlert('order-ready', orderIdParam);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderIdParam, playAlert, queryClient]);

  useEffect(() => {
    if (!orderData?.status) return;
    if (orderData.status === 'ready' && lastStatusRef.current !== 'ready') {
      void playAlert('order-ready', orderData.id);
    }
    lastStatusRef.current = orderData.status;
  }, [orderData?.id, orderData?.status, playAlert]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#f9ecdd]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }}
      >
        <View className="px-4 gap-3.5">
          <View className="bg-white rounded-2xl border border-[#e1a255]/40 px-4 py-3.5 gap-2.5">
            <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">
              Ambrosia | Traccia il tuo ordine
            </Text>
            <Text className="text-gray-900 text-[13px]">{estimatedLabel}</Text>
            <Text className="text-[46px] leading-[48px] font-black text-gray-900">{estimatedTime}</Text>
            <Text className="text-gray-600 text-sm leading-5">{summaryText}</Text>
            <View className="self-start bg-[#f3dabb] rounded-full px-3 py-1.5">
              <View className="flex-row items-center gap-1.5">
                <FontAwesome name={statusBadge.icon} size={11} color="#8d171e" />
                <Text className="text-[#8d171e] text-xs font-bold">{statusBadge.label}</Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-2.5">
            {trackingSteps.map((step, index) => {
              const isLast = index === trackingSteps.length - 1;
              const isCompleted = step.state === 'completed';
              const isActive = step.state === 'active';

              return (
                <View key={step.key} className="flex-row gap-3">
                  <View className="items-center">
                    <View
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        isCompleted || isActive ? 'bg-[#8d171e]' : 'bg-[#f3dabb]'
                      }`}
                    >
                      <FontAwesome
                        name={step.icon}
                        size={15}
                        color={isCompleted || isActive ? '#fff' : '#9a3412'}
                      />
                    </View>
                    {!isLast && (
                      <View
                        className={`w-[2px] h-10 ${
                          isCompleted ? 'bg-[#8d171e]' : 'bg-[#e7b577]/50'
                        }`}
                      />
                    )}
                  </View>
                  <View className="pt-1">
                    <Text className="text-gray-900 font-bold text-base">{step.label}</Text>
                    <Text
                      className={`text-xs ${
                        isActive ? 'text-[#8d171e] font-semibold' : 'text-gray-500'
                      }`}
                    >
                      {step.subtext}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {trackedStatus === 'cancelled' ? (
            <View className="bg-red-50 rounded-2xl border border-red-200 p-4 gap-1.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-red-700">
                Motivo rifiuto
              </Text>
              <Text className="text-base font-bold text-red-800">
                {trackedDeclinePreset || 'Ordine rifiutato'}
              </Text>
              {trackedDeclineNote ? (
                <Text className="text-sm text-red-700">{trackedDeclineNote}</Text>
              ) : null}
            </View>
          ) : null}

          {orderType === 'delivery' ? (
            <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-3">
              <Text className="text-xl font-extrabold text-gray-900">{supportTitle}</Text>
              <Text className="text-sm text-gray-600">{supportDescription}</Text>
              <View className="flex-row gap-2">
                <Pressable className="flex-1 h-11 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90 flex-row gap-1.5">
                  <FontAwesome name="phone" size={13} color="#ffffff" />
                  <Text className="text-white font-bold">Chiama</Text>
                </Pressable>
                <Pressable className="flex-1 h-11 rounded-xl bg-[#f3dabb] items-center justify-center active:opacity-90 flex-row gap-1.5">
                  <FontAwesome name="comment" size={13} color="#8d171e" />
                  <Text className="text-[#8d171e] font-bold">Chat</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-2">
              <Text className="text-xl font-extrabold text-gray-900">{supportTitle}</Text>
              <Text className="text-sm text-gray-600">{supportDescription}</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/menu')}
            className="h-12 rounded-xl bg-[#1f2937] items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-bold">Nuovo ordine</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
