import type { HomeTrendingPizza } from '@/components/features/home/types';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { FlatList, ImageBackground, Pressable, Text, View, useWindowDimensions } from 'react-native';

const ITEM_GAP = 12;

interface HomeTrendingSectionProps {
  readonly title: string;
  readonly pizzas: HomeTrendingPizza[];
  readonly onOpenAll: () => void;
  readonly onOpenPizza: (pizza: HomeTrendingPizza) => void;
  readonly onQuickAddPizza?: (pizzaId: string) => void;
}

export function HomeTrendingSection({
  title,
  pizzas,
  onOpenAll,
  onOpenPizza,
  onQuickAddPizza,
}: HomeTrendingSectionProps) {
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<HomeTrendingPizza>>(null);
  const isRecenteringRef = useRef(false);

  const cardHeight = useMemo(() => {
    if (width < 430) return 182;
    if (width < 900) return 198;
    return 220;
  }, [width]);
  const carouselHeight = cardHeight * 3 + 24;
  const mediaHeight = cardHeight - 46;
  const initialIndex = pizzas.length > 1 ? 1 : 0;
  const supportsInfiniteLoop = pizzas.length > 1;
  const loopedPizzas = useMemo(() => {
    if (!supportsInfiniteLoop) return pizzas;
    return [...pizzas, ...pizzas, ...pizzas, ...pizzas, ...pizzas, ...pizzas, ...pizzas];
  }, [pizzas, supportsInfiniteLoop]);
  const centerBlockStart = supportsInfiniteLoop ? pizzas.length * 3 : 0;
  const initialScrollIndex = centerBlockStart + initialIndex;
  const initialSelectedIndex = Math.max(0, Math.min(pizzas.length - 1, initialIndex + 1));
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

  const normalizeLoopIndex = (index: number) => {
    if (!supportsInfiniteLoop || pizzas.length === 0) return Math.max(0, Math.min(pizzas.length - 1, index));
    return ((index % pizzas.length) + pizzas.length) % pizzas.length;
  };

  const recenterIfNeeded = (offset: number) => {
    if (!supportsInfiniteLoop || pizzas.length === 0) return offset;
    if (isRecenteringRef.current) return offset;

    const itemSpan = cardHeight + ITEM_GAP;
    const rawIndex = Math.round(offset / itemSpan);
    const normalizedIndex = normalizeLoopIndex(rawIndex);
    const minSafeIndex = pizzas.length * 1.5;
    const maxSafeIndex = pizzas.length * 5.5;

    if (rawIndex <= minSafeIndex || rawIndex >= maxSafeIndex) {
      const recenteredIndex = centerBlockStart + normalizedIndex;
      const recenteredOffset = recenteredIndex * itemSpan;
      isRecenteringRef.current = true;
      flatListRef.current?.scrollToOffset({
        offset: recenteredOffset,
        animated: false,
      });
      requestAnimationFrame(() => {
        isRecenteringRef.current = false;
      });
      return recenteredOffset;
    }

    return offset;
  };

  const getFocusIndex = (offset: number) => {
    const baseIndex = Math.round(offset / (cardHeight + ITEM_GAP));
    const shiftedIndex = baseIndex + 1;
    return normalizeLoopIndex(shiftedIndex);
  };

  return (
    <View className="bg-white/80 border border-[#ead8c7] rounded-3xl p-3.5 shadow-sm">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          <FontAwesome name="fire" size={15} color="#ea580c" />
          <Text className="text-[28px] font-black text-gray-900">{title}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-orange-600 text-sm font-extrabold">Scorri giu</Text>
          <FontAwesome name="long-arrow-down" size={14} color="#ea580c" />
        </View>
      </View>

      <View className="relative" style={{ height: carouselHeight }}>
        <FlatList
          ref={flatListRef}
          data={loopedPizzas}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          nestedScrollEnabled
          initialScrollIndex={initialScrollIndex}
          getItemLayout={(_, index) => ({
            length: cardHeight + ITEM_GAP,
            offset: (cardHeight + ITEM_GAP) * index,
            index,
          })}
          snapToInterval={cardHeight + ITEM_GAP}
          decelerationRate="fast"
          snapToAlignment="start"
          onMomentumScrollEnd={(event) => {
            const offset = event.nativeEvent.contentOffset.y;
            const effectiveOffset = recenterIfNeeded(offset);
            const boundedIndex = getFocusIndex(effectiveOffset);
            setSelectedIndex(boundedIndex);
          }}
          onScroll={(event) => {
            const offset = event.nativeEvent.contentOffset.y;
            const effectiveOffset = recenterIfNeeded(offset);
            const boundedIndex = getFocusIndex(effectiveOffset);
            if (boundedIndex !== selectedIndex) {
              setSelectedIndex(boundedIndex);
            }
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: ITEM_GAP, paddingBottom: 4 }}
          renderItem={({ item: pizza, index }) => {
            const sourceIndex = normalizeLoopIndex(index);
            const isFeatured = sourceIndex === selectedIndex;
            return (
            <Pressable
              key={pizza.id}
              style={{
                height: cardHeight,
                transform: [{ scale: isFeatured ? 1 : 0.95 }],
                opacity: isFeatured ? 1 : 0.65,
              }}
              className={`rounded-[22px] overflow-hidden active:scale-98 bg-[#efe3d4] ${
                isFeatured ? 'border-2 border-orange-500 shadow-xl' : 'border border-[#e7d8c8] shadow-sm'
              }`}
              onPress={() => {
                setSelectedIndex(sourceIndex);
                onOpenPizza(pizza);
              }}
            >
              <ImageBackground
                source={{
                  uri:
                    pizza.imageUrl ||
                    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
                }}
                style={{ height: mediaHeight }}
                className="w-full justify-end"
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.12)', 'rgba(32,20,14,0.74)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  className="px-4 py-3"
                >
                  <View className="bg-orange-500 self-start rounded-full px-2.5 py-1 mb-1">
                    <Text className="text-white text-[10px] font-bold">{pizza.badge}</Text>
                  </View>
                  {isFeatured ? (
                    <View className="bg-white/90 self-start rounded-full px-2.5 py-1 mb-1">
                      <Text className="text-orange-700 text-[10px] font-extrabold">In evidenza</Text>
                    </View>
                  ) : null}
                  {isFeatured ? (
                    <View className="bg-orange-500/90 self-start rounded-full px-2.5 py-1 mb-1">
                      <Text className="text-white text-[10px] font-extrabold">SELEZIONATA</Text>
                    </View>
                  ) : null}
                  <Text className="font-black text-white text-[23px]" numberOfLines={1}>
                    {pizza.name}
                  </Text>
                  <Text className="text-orange-50 text-xs mt-0.5" numberOfLines={2}>
                    {pizza.description}
                  </Text>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-orange-100 font-black text-2xl">€{pizza.price.toFixed(2)}</Text>
                    <View className="bg-black/30 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                      <FontAwesome name="clock-o" size={13} color="#f4f4f5" />
                      <Text className="text-zinc-100 text-[11px] font-semibold">15-20 min</Text>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
              <View className="bg-white border-t border-[#f2e4d6] min-h-[46px] px-3 py-2 justify-center">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-gray-500">Consegna rapida</Text>
                  {onQuickAddPizza ? (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        onQuickAddPizza(pizza.id);
                      }}
                      className="w-8 h-8 rounded-full bg-orange-500 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={`Aggiungi ${pizza.name} al carrello`}
                    >
                      <FontAwesome name="plus" size={12} color="#ffffff" />
                    </Pressable>
                  ) : (
                    <Text className="text-xs font-bold text-orange-600">Aggiungi →</Text>
                  )}
                </View>
              </View>
            </Pressable>
            );
          }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['#fdf9f3', 'rgba(253,249,243,0)']}
          className="absolute left-0 right-0 top-0 h-7 rounded-t-2xl"
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(253,249,243,0)', '#fdf9f3']}
          className="absolute left-0 right-0 bottom-0 h-7 rounded-b-2xl"
        />
      </View>
    </View>
  );
}
