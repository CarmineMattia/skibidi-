/**
 * Kitchen Dashboard Screen
 * Real-time order management for kitchen staff
 */

import { View, Text, FlatList, ActivityIndicator, Dimensions, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKitchenOrders } from '@/lib/hooks/useKitchenOrders';
import { KitchenOrderCard } from '@/components/features/KitchenOrderCard';
import { FiscalRetryPanel } from '@/components/features/FiscalRetryPanel';
import { TimeWheelModal } from '@/components/ui/TimeWheelModal';
import { useEffect, useState } from 'react';
import type { Database } from '@/types/database.types.generated';
import { FontAwesome } from '@expo/vector-icons';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { useAuth } from '@/lib/stores/AuthContext';
import { useRouter } from 'expo-router';
import { getNextOpening, isOpenAt } from '@/lib/utils/businessHours';

type OrderStatus = Database['public']['Enums']['order_status'];

const FILTER_OPTIONS: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Attivi', statuses: ['pending', 'preparing', 'ready'] },
  { label: 'Nuovi', statuses: ['pending'] },
  { label: 'In Preparazione', statuses: ['preparing'] },
  { label: 'Pronti', statuses: ['ready'] },
  { label: 'Tutti', statuses: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'] },
];

export default function KitchenScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const viewportWidth = Dimensions.get('window').width;
  const effectiveWidth = Math.min(width, viewportWidth);
  const isMobile = effectiveWidth < 768;
  const isUltraCompact = effectiveWidth < 400;
  const isTablet = effectiveWidth >= 768 && effectiveWidth < 1200;
  const columns = effectiveWidth >= 1200 ? 3 : effectiveWidth >= 768 ? 2 : 1;
  const [selectedFilterIndex, setSelectedFilterIndex] = useState(0);
  const [showFiscalRetry, setShowFiscalRetry] = useState(false);
  const [showPausePicker, setShowPausePicker] = useState(false);
  const [deviceNow, setDeviceNow] = useState(() => new Date());
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { acceptingOrders, ordersPausedUntil, pauseOrdersForMinutes, resumeOrders, businessHours } = useAppSettings();
  const selectedFilter = FILTER_OPTIONS[selectedFilterIndex];
  const pausedUntilDate =
    ordersPausedUntil && !Number.isNaN(new Date(ordersPausedUntil).getTime())
      ? new Date(ordersPausedUntil)
      : null;
  const isClosedByManualSettings =
    !acceptingOrders || (pausedUntilDate ? pausedUntilDate.getTime() > Date.now() : false);
  const isClosedByWorkingHours = !isOpenAt(deviceNow, businessHours);
  const nextOpening = getNextOpening(deviceNow, businessHours);
  const isClosedNow = isClosedByManualSettings || isClosedByWorkingHours;
  const canManualReopen = isClosedByManualSettings;
  const showHoursShortcut = isClosedByWorkingHours && !canManualReopen;
  const remainingPauseMs = pausedUntilDate ? pausedUntilDate.getTime() - deviceNow.getTime() : 0;

  const formatRemainingPause = (remainingMs: number): string => {
    if (remainingMs <= 0) return '0m';
    const totalMinutes = Math.ceil(remainingMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setDeviceNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: orders = [], isLoading, error, refetch } = useKitchenOrders({
    statuses: selectedFilter.statuses,
  });

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-8">
        <FontAwesome name="exclamation-triangle" size={44} color="#f59e0b" style={{ marginBottom: 12 }} />
        <Text className="text-foreground font-bold text-xl text-center mb-2">
          Errore nel caricamento
        </Text>
        <Text className="text-muted-foreground text-center mb-6">
          {error.message}
        </Text>
        <Pressable
          className="bg-primary px-6 py-3 rounded-xl"
          onPress={() => refetch()}
        >
          <Text className="text-primary-foreground font-bold">Riprova</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className={`px-3 md:px-8 ${isMobile ? (isUltraCompact ? 'py-2' : 'py-2.5') : 'py-5'} border-b-2 border-border bg-card shadow-sm`}>
        {isMobile ? (
          <View className="gap-2 mb-2">
            <View className="flex-row items-center gap-2">
              <FontAwesome name="fire" size={isUltraCompact ? 16 : 18} color="#111827" />
              <Text className={`text-foreground font-extrabold tracking-tight ${isUltraCompact ? 'text-lg' : 'text-xl'}`}>
                Cucina
              </Text>
              <View className={`rounded-full border border-gray-300 bg-gray-100 ${isUltraCompact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'}`}>
                <Text className={`text-gray-700 font-semibold ${isUltraCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                  {deviceNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Pressable
                className={`bg-yellow-500 rounded-full flex-row items-center active:opacity-80 ${isUltraCompact ? 'px-2 py-1 gap-1' : 'px-3 py-1.5 gap-1.5'}`}
                onPress={() => setShowFiscalRetry(true)}
              >
                <FontAwesome name="exclamation-triangle" size={isUltraCompact ? 12 : 14} color="white" />
                <Text className={`text-white font-bold ${isUltraCompact ? 'text-[10px]' : 'text-xs'}`}>Fiscal</Text>
              </Pressable>
              <View className={`bg-green-500 rounded-full flex-row items-center ${isUltraCompact ? 'px-2 py-1 gap-1' : 'px-3 py-1.5 gap-1.5'}`}>
                <View className={`${isUltraCompact ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-white rounded-full animate-pulse`} />
                <Text className={`text-white font-bold ${isUltraCompact ? 'text-[10px]' : 'text-xs'}`}>LIVE</Text>
              </View>
              {isAdmin && (
                <View className="flex-row items-center gap-1">
                  <Pressable
                    className={`${isClosedNow ? 'bg-emerald-600' : 'bg-red-600'} rounded-full flex-row items-center active:opacity-80 ${isUltraCompact ? 'px-2 py-1 gap-1' : 'px-3 py-1.5 gap-1.5'}`}
                    onPress={() => {
                      if (isClosedNow) {
                        if (canManualReopen) {
                          resumeOrders();
                        } else {
                          router.push('/admin-options');
                        }
                        return;
                      }
                      setShowPausePicker(true);
                    }}
                  >
                    <FontAwesome name={isClosedNow ? 'play' : 'pause'} size={isUltraCompact ? 10 : 12} color="white" />
                    <Text className={`text-white font-bold ${isUltraCompact ? 'text-[10px]' : 'text-xs'}`}>
                      {isClosedNow ? (canManualReopen ? 'Apri' : 'Orari') : 'Stop'}
                    </Text>
                  </Pressable>
                  {isClosedNow && pausedUntilDate && remainingPauseMs > 0 && (
                    <View className={`${isUltraCompact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded-full bg-gray-700`}>
                      <Text className={`text-white font-bold ${isUltraCompact ? 'text-[10px]' : 'text-xs'}`}>
                        {formatRemainingPause(remainingPauseMs)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <View className={`bg-primary rounded-full ${isUltraCompact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
                <Text className={`text-primary-foreground font-bold ${isUltraCompact ? 'text-[11px]' : 'text-sm'}`}>
                  {orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center justify-between gap-3 mb-3">
            <View className="flex-row items-center gap-2 md:gap-3">
              <FontAwesome name="fire" size={24} color="#111827" />
              <Text className="text-foreground font-extrabold tracking-tight text-2xl md:text-3xl">
                Cucina
              </Text>
              <View className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1">
                <Text className="text-gray-700 font-semibold text-xs">
                  {deviceNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2 md:gap-3">
              <Pressable
                className="bg-yellow-500 rounded-full flex-row items-center gap-2 active:opacity-80 px-4 py-2"
                onPress={() => setShowFiscalRetry(true)}
              >
                <FontAwesome name="exclamation-triangle" size={16} color="white" />
                <Text className="text-white font-bold text-sm">Fiscal</Text>
              </Pressable>
              <View className="bg-green-500 rounded-full flex-row items-center gap-2 px-4 py-2">
                <View className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <Text className="text-white font-bold text-sm">LIVE</Text>
              </View>
              {isAdmin && (
                <View className="flex-row items-center gap-2">
                  <Pressable
                    className={`rounded-full flex-row items-center gap-2 active:opacity-80 px-4 py-2 ${isClosedNow ? 'bg-emerald-600' : 'bg-red-600'}`}
                    onPress={() => {
                      if (isClosedNow) {
                        if (canManualReopen) {
                          resumeOrders();
                        } else {
                          router.push('/admin-options');
                        }
                        return;
                      }
                      setShowPausePicker(true);
                    }}
                  >
                    <FontAwesome name={isClosedNow ? 'play' : 'pause'} size={14} color="white" />
                    <Text className="text-white font-bold text-sm">
                      {isClosedNow ? (canManualReopen ? 'Riapri' : 'Orari') : 'Stop'}
                    </Text>
                  </Pressable>
                  {isClosedNow && pausedUntilDate && remainingPauseMs > 0 && (
                    <View className="rounded-full bg-gray-700 px-3 py-2">
                      <Text className="text-white font-bold text-sm">
                        {formatRemainingPause(remainingPauseMs)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <View className="bg-primary rounded-full px-5 py-2">
                <Text className="text-primary-foreground font-bold text-lg">
                  {orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pr-2 pl-0.5"
        >
          {FILTER_OPTIONS.map((filter, index) => (
            <Pressable
              key={filter.label}
              className={`${isMobile ? (isUltraCompact ? 'px-2.5 py-1.5' : 'px-3 py-2') : 'px-4 py-2'} rounded-xl ${
                selectedFilterIndex === index
                  ? 'bg-primary'
                  : 'bg-secondary'
              }`}
              onPress={() => setSelectedFilterIndex(index)}
            >
              <Text
                className={`font-bold ${isMobile ? (isUltraCompact ? 'text-[10px]' : 'text-xs') : 'text-sm'} ${
                  selectedFilterIndex === index
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {isClosedNow && (
          <View className="mt-3 rounded-xl border p-3 bg-red-50 border-red-200">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2 flex-1">
                <FontAwesome
                  name="pause-circle"
                  size={16}
                  color="#b91c1c"
                />
                <Text className="font-semibold text-red-700">
                  Disponibilita ordini
                </Text>
              </View>
              {isAdmin && (
                <Pressable
                  className="px-3 py-2 rounded-lg bg-white border border-border"
                  onPress={() => router.push('/admin-options')}
                >
                  <Text className="text-xs font-bold text-gray-700">Gestisci</Text>
                </Pressable>
              )}
            </View>

            {pausedUntilDate && (
              <Text className="text-xs text-red-700 mt-1">
                Pausa fino alle {pausedUntilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            )}
            {!pausedUntilDate && nextOpening && (
              <Text className="text-xs text-red-700 mt-1">
                Riapertura prevista alle {nextOpening.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            )}
            <Text className="text-xs text-red-700 mt-1">
              Ordini non disponibili in questo momento.
            </Text>

            {isAdmin && (
              <View className="flex-row gap-2 mt-2">
                <Pressable
                  className="flex-1 h-9 rounded-lg items-center justify-center bg-emerald-600"
                  onPress={() => {
                    if (canManualReopen) {
                      resumeOrders();
                    } else {
                      router.push('/admin-options');
                    }
                  }}
                >
                  <Text className="text-white text-xs font-bold">
                    {canManualReopen ? 'Riattiva ora' : (showHoursShortcut ? 'Orari negozio' : 'Disponibilita ordini')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Orders Grid */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" className="text-primary" />
          <Text className="text-muted-foreground mt-4">Caricamento ordini...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <FontAwesome name="check-circle" size={60} color="#10b981" style={{ marginBottom: 12 }} />
          <Text className="text-foreground font-extrabold text-2xl text-center mb-2">
            Nessun ordine
          </Text>
          <Text className="text-muted-foreground text-center text-lg">
            {selectedFilter.label === 'Attivi'
              ? 'Tutti gli ordini sono stati completati!'
              : `Nessun ordine nello stato "${selectedFilter.label}"`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          key={`kitchen-${columns}`}
          contentContainerClassName={`${isMobile ? 'p-3 pb-28' : isTablet ? 'p-4 pb-24' : 'p-6 pb-24'}`}
          columnWrapperClassName={columns > 1 ? (isTablet ? 'gap-4' : 'gap-6') : undefined}
          ItemSeparatorComponent={() => <View className={isMobile ? 'h-3' : 'h-4 md:h-6'} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="flex-1">
              <KitchenOrderCard order={item} />
            </View>
          )}
        />
      )}

      <FiscalRetryPanel
        visible={showFiscalRetry}
        onClose={() => setShowFiscalRetry(false)}
      />
      <TimeWheelModal
        visible={showPausePicker}
        title="Stop cucina per quanto?"
        confirmLabel="Imposta stop"
        hourMin={0}
        hourMax={12}
        minuteStep={5}
        initialHour={0}
        initialMinute={30}
        onClose={() => setShowPausePicker(false)}
        onConfirm={(hour, minute) => {
          const totalMinutes = Math.max(1, hour * 60 + minute);
          pauseOrdersForMinutes(totalMinutes);
          setShowPausePicker(false);
        }}
      />
    </View>
  );
}
