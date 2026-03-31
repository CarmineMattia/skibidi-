/**
 * Kitchen Dashboard Screen
 * Real-time order management for kitchen staff
 */

import { View, Text, FlatList, ActivityIndicator, Dimensions, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKitchenOrders } from '@/lib/hooks/useKitchenOrders';
import { KitchenOrderCard } from '@/components/features/KitchenOrderCard';
import { FiscalRetryPanel } from '@/components/features/FiscalRetryPanel';
import { useState } from 'react';
import type { Database } from '@/types/database.types.generated';
import { FontAwesome } from '@expo/vector-icons';

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
  const selectedFilter = FILTER_OPTIONS[selectedFilterIndex];

  const { data: orders = [], isLoading, error, refetch } = useKitchenOrders({
    statuses: selectedFilter.statuses,
  });

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-6xl mb-4">⚠️</Text>
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
              <Text className={isUltraCompact ? 'text-xl' : 'text-2xl'}>👨‍🍳</Text>
              <Text className={`text-foreground font-extrabold tracking-tight ${isUltraCompact ? 'text-lg' : 'text-xl'}`}>
                Cucina
              </Text>
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
              <Text className="text-3xl md:text-4xl">👨‍🍳</Text>
              <Text className="text-foreground font-extrabold tracking-tight text-2xl md:text-3xl">
                Cucina
              </Text>
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
      </View>

      {/* Orders Grid */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" className="text-primary" />
          <Text className="text-muted-foreground mt-4">Caricamento ordini...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-8xl mb-4">✅</Text>
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
    </View>
  );
}
