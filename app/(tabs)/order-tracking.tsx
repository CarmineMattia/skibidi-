import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/api/supabase';
import { useCustomerOrderAlert } from '@/lib/hooks/useCustomerOrderAlert';
import { useOrder } from '@/lib/hooks/useOrders';
import { formatRescheduleLabel, parseRescheduleFromNote } from '@/lib/utils/orderDecline';
import {
  getEstimatedReadyTime,
  getTrackingBadge,
  getTrackingSteps,
  getTrackingSummary,
  normalizeOrderType,
} from '@/lib/utils/orderTracking';
import { getOrderDisplayCode } from '@/lib/utils/orderDisplayCode';
import { SkeletonOrderTracking } from '@/components/ui/Skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
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
  const { data: orderData, isLoading: isOrderLoading } = useOrder(orderIdParam ?? '');
  const { playStatusAlert } = useCustomerOrderAlert();
  const lastStatusRef = useRef<string | null>(null);
  const [customerNotice, setCustomerNotice] = useState<{
    tone: 'success' | 'warning' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const showSkeleton = Boolean(orderIdParam) && isOrderLoading && !orderData;

  const orderType = normalizeOrderType(orderData?.order_type ?? rawOrderType);
  const orderRef = orderData
    ? getOrderDisplayCode(orderData)
    : orderIdParam
      ? getOrderDisplayCode({ id: orderIdParam, display_code: null })
      : 'Margherita #1';
  const trackedStatus = orderData?.status ?? null;
  const trackedDeclinePreset = orderData?.decline_reason_preset ?? null;
  const trackedDeclineNote = orderData?.decline_reason_note ?? null;
  const rescheduleInfo = useMemo(
    () => parseRescheduleFromNote(trackedDeclineNote),
    [trackedDeclineNote]
  );
  const rescheduleLabel = formatRescheduleLabel(rescheduleInfo.rescheduleAt);

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
            void playStatusAlert(`${orderIdParam}:ready`);
            setCustomerNotice({
              tone: 'success',
              title: 'Ordine pronto!',
              message: 'Il tuo ordine è pronto. Puoi ritirarlo o attendere la consegna.',
            });
          }

          if (nextStatus === 'preparing' && prevStatus === 'pending') {
            void playStatusAlert(`${orderIdParam}:accepted`);
            setCustomerNotice({
              tone: 'success',
              title: 'Ordine confermato',
              message: 'La cucina ha accettato il tuo ordine e ha iniziato la preparazione.',
            });
          }

          if (nextStatus === 'cancelled' && prevStatus !== 'cancelled') {
            void playStatusAlert(`${orderIdParam}:cancelled`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderIdParam, playStatusAlert, queryClient]);

  useEffect(() => {
    if (!orderData?.status) return;
    const previous = lastStatusRef.current;
    const current = orderData.status;

    if (current === 'ready' && previous !== 'ready') {
      void playStatusAlert(`${orderData.id}:ready`);
      setCustomerNotice({
        tone: 'success',
        title: 'Ordine pronto!',
        message: 'Il tuo ordine è pronto. Puoi ritirarlo o attendere la consegna.',
      });
    }

    if (current === 'preparing' && previous === 'pending') {
      void playStatusAlert(`${orderData.id}:accepted`);
      setCustomerNotice({
        tone: 'success',
        title: 'Ordine confermato',
        message: 'La cucina ha accettato il tuo ordine e ha iniziato la preparazione.',
      });
    }

    if (current === 'cancelled' && previous !== 'cancelled') {
      void playStatusAlert(`${orderData.id}:cancelled`);
      const parsed = parseRescheduleFromNote(orderData.decline_reason_note);
      const label = formatRescheduleLabel(parsed.rescheduleAt);
      setCustomerNotice({
        tone: 'error',
        title: 'Ordine non accettato',
        message: label
          ? `Il ristorante propone di ripianificare per ${label}.`
          : orderData.decline_reason_preset || 'Il ristorante non ha potuto accettare il tuo ordine.',
      });
    }

    lastStatusRef.current = current;
  }, [
    orderData?.decline_reason_note,
    orderData?.decline_reason_preset,
    orderData?.id,
    orderData?.status,
    playStatusAlert,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#f9ecdd]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }}
      >
        <View className="px-4 gap-3.5">
          {showSkeleton ? (
            <SkeletonOrderTracking />
          ) : (
            <>
          {customerNotice ? (
            <View
              className={`rounded-2xl border p-4 ${
                customerNotice.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200'
                  : customerNotice.tone === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
              }`}
            >
              <Text
                className={`text-xs font-bold uppercase tracking-wider ${
                  customerNotice.tone === 'success'
                    ? 'text-emerald-700'
                    : customerNotice.tone === 'warning'
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                Aggiornamento ordine
              </Text>
              <Text className="text-base font-extrabold text-gray-900 mt-1">{customerNotice.title}</Text>
              <Text className="text-sm text-gray-700 mt-1">{customerNotice.message}</Text>
            </View>
          ) : null}

          {trackedStatus === 'pending' || (!trackedStatus && !showSkeleton) ? (
            <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#92400e" />
                <Text className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  In attesa di conferma
                </Text>
              </View>
              <Text className="text-base font-extrabold text-gray-900 mt-2">
                Il tuo ordine è in attesa di conferma. Non chiudere la pagina.
              </Text>
              <Text className="text-sm text-amber-800 mt-1">
                Ti aggiorniamo in tempo reale appena la cucina accetta o rifiuta l&apos;ordine.
              </Text>
            </View>
          ) : null}

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
              {rescheduleLabel ? (
                <Text className="text-sm font-semibold text-red-800">
                  Nuovo orario proposto: {rescheduleLabel}
                </Text>
              ) : null}
              {rescheduleInfo.message ? (
                <Text className="text-sm text-red-700">{rescheduleInfo.message}</Text>
              ) : trackedDeclineNote && !rescheduleLabel ? (
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
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
