/**
 * Kitchen Dashboard Screen
 * Real-time order management for kitchen staff
 */

import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
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
      <View className="px-8 py-5 border-b-2 border-border bg-card shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-4xl">👨‍🍳</Text>
            <Text className="text-foreground font-extrabold text-3xl tracking-tight">
              Cucina
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            {/* Fiscal retry button */}
            <Pressable
              className="bg-yellow-500 rounded-full px-4 py-2 flex-row items-center gap-2 active:opacity-80"
              onPress={() => setShowFiscalRetry(true)}
            >
              <FontAwesome name="exclamation-triangle" size={16} color="white" />
              <Text className="text-white font-bold text-sm">Fiscal</Text>
            </Pressable>

            {/* Live indicator */}
            <View className="bg-green-500 rounded-full px-4 py-2 flex-row items-center gap-2">
              <View className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <Text className="text-white font-bold text-sm">LIVE</Text>
            </View>

            {/* Order count */}
            <View className="bg-primary rounded-full px-5 py-2">
              <Text className="text-primary-foreground font-bold text-lg">
                {orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row gap-2">
          {FILTER_OPTIONS.map((filter, index) => (
            <Pressable
              key={filter.label}
              className={`px-5 py-2.5 rounded-xl ${
                selectedFilterIndex === index
                  ? 'bg-primary'
                  : 'bg-secondary'
              }`}
              onPress={() => setSelectedFilterIndex(index)}
            >
              <Text
                className={`font-bold text-sm ${
                  selectedFilterIndex === index
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
          numColumns={3}
          contentContainerClassName="p-6 pb-24"
          columnWrapperClassName="gap-6"
          ItemSeparatorComponent={() => <View className="h-6" />}
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
