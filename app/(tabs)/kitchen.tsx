/**
 * Kitchen Dashboard Screen
 * Real-time order management for kitchen staff
 */

import { View, Text, FlatList, Dimensions, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SkeletonKitchenGrid } from '@/components/ui/Skeleton';
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

// Self-contained digital clock — local 1s tick so the order grid does not re-render.
function KitchenClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');

  return (
    <View
      className={`flex-row items-center rounded-xl border border-[#2a1810] bg-[#1a100c] ${
        compact ? 'px-2.5 py-1.5 gap-1' : 'px-3.5 py-2 gap-1.5'
      }`}
      accessibilityRole="text"
      accessibilityLabel={`Ora ${hours}:${minutes}:${seconds}`}
    >
      <View className={`${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-emerald-400`} />
      <Text
        className={`text-[#f3dabb] font-black tracking-[0.12em] ${
          compact ? 'text-sm' : 'text-base md:text-lg'
        }`}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      >
        {hours}
        <Text className="text-[#e7b577]">:</Text>
        {minutes}
        <Text className="text-[#8d171e]/80">:</Text>
        <Text className="text-[#e7b577]/90">{seconds}</Text>
      </Text>
    </View>
  );
}

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
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
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
    // Open/closed state and the pause countdown only display minute
    // granularity — a 30 s tick avoids re-rendering the whole order grid
    // every second (the visible seconds clock has its own local timer).
    const timer = setInterval(() => {
      setDeviceNow(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data: orders = [], isLoading, error, refetch } = useKitchenOrders({
    statuses: selectedFilter.statuses,
    enabled: isAdmin,
  });

  // Redirect non-admin users away after the navigator is mounted (avoids
  // "Attempted to navigate before mounting the Root Layout component" on web).
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAdmin) {
      router.replace('/(tabs)/menu');
    }
  }, [isAdmin, isAuthLoading, router]);

  if (!isAdmin) {
    return null;
  }

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
      <View className={`px-3 md:px-8 ${isMobile ? (isUltraCompact ? 'py-2' : 'py-2.5') : 'py-4'} border-b border-[#e1a255]/35 bg-[#f9ecdd]`}>
        <View className={`flex-row items-center justify-between gap-2 ${isMobile ? 'mb-2' : 'mb-3'}`}>
          <View className="flex-row items-center gap-2 md:gap-3 flex-1 min-w-0">
            <View className={`${isUltraCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-[#8d171e] items-center justify-center`}>
              <FontAwesome name="fire" size={isUltraCompact ? 14 : 18} color="#ffffff" />
            </View>
            <View className="min-w-0">
              <Text className={`text-[#1a100c] font-black tracking-tight ${isUltraCompact ? 'text-lg' : isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
                Cucina
              </Text>
              {!isUltraCompact ? (
                <Text className="text-[#8d171e] text-[10px] font-bold uppercase tracking-wider">
                  {orders.length} {orders.length === 1 ? 'ordine attivo' : 'ordini attivi'}
                </Text>
              ) : null}
            </View>
            <KitchenClock compact={isMobile} />
          </View>

          <View className="flex-row items-center gap-1.5 md:gap-2">
            <Pressable
              accessibilityLabel="Errori fiscali"
              className={`rounded-xl bg-[#c45c16] flex-row items-center active:opacity-85 ${
                isUltraCompact ? 'px-2 py-2' : isMobile ? 'px-2.5 py-2 gap-1' : 'px-3.5 py-2.5 gap-2'
              }`}
              onPress={() => setShowFiscalRetry(true)}
            >
              <FontAwesome name="file-text-o" size={isUltraCompact ? 12 : 14} color="white" />
              {!isUltraCompact ? (
                <Text className={`text-white font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>Fiscal</Text>
              ) : null}
            </Pressable>

            {isAdmin ? (
              <Pressable
                accessibilityLabel={isClosedNow ? (canManualReopen ? 'Riapri ordini' : 'Gestisci orari') : 'Metti in pausa gli ordini'}
                className={`rounded-xl flex-row items-center active:opacity-85 ${
                  isClosedNow ? 'bg-emerald-700' : 'bg-[#8d171e]'
                } ${isUltraCompact ? 'px-2 py-2' : isMobile ? 'px-2.5 py-2 gap-1' : 'px-3.5 py-2.5 gap-2'}`}
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
                <FontAwesome name={isClosedNow ? 'play' : 'pause'} size={isUltraCompact ? 11 : 13} color="white" />
                {!isUltraCompact ? (
                  <Text className={`text-white font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {isClosedNow ? (canManualReopen ? 'Apri' : 'Orari') : 'Pausa'}
                  </Text>
                ) : null}
              </Pressable>
            ) : null}

            {isClosedNow && pausedUntilDate && remainingPauseMs > 0 ? (
              <View className={`rounded-xl bg-[#1a100c] ${isUltraCompact ? 'px-2 py-2' : 'px-3 py-2.5'}`}>
                <Text className={`text-[#f3dabb] font-bold ${isUltraCompact ? 'text-[10px]' : 'text-xs'}`}>
                  {formatRemainingPause(remainingPauseMs)}
                </Text>
              </View>
            ) : null}

            <View
              className={`rounded-xl border border-[#8d171e]/25 bg-white ${
                isUltraCompact ? 'px-2 py-2' : isMobile ? 'px-2.5 py-2' : 'px-3.5 py-2.5'
              }`}
            >
              <Text className={`text-[#8d171e] font-black ${isUltraCompact ? 'text-xs' : isMobile ? 'text-sm' : 'text-base'}`}>
                {orders.length}
                {!isUltraCompact ? (
                  <Text className="text-[#8d171e]/70 font-bold text-xs">
                    {' '}
                    {orders.length === 1 ? 'ordine' : 'ordini'}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>
        </View>

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
                  ? 'bg-[#8d171e]'
                  : 'bg-white border border-[#e1a255]/40'
              }`}
              onPress={() => setSelectedFilterIndex(index)}
            >
              <Text
                className={`font-bold ${isMobile ? (isUltraCompact ? 'text-[10px]' : 'text-xs') : 'text-sm'} ${
                  selectedFilterIndex === index
                    ? 'text-white'
                    : 'text-[#5c4033]'
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
        <SkeletonKitchenGrid count={columns * 2} columns={columns} />
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
