import type { HomeTrendingPizza } from '@/components/features/home/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ImageBackground, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
const CARD_GAP = 12;

interface HomeTrendingSectionProps {
  readonly title: string;
  readonly pizzas: HomeTrendingPizza[];
  readonly onOpenAll: () => void;
  readonly onOpenPizza: (pizzaId: string) => void;
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

  const cardWidth = useMemo(() => {
    // Wider cards on web/tablet to avoid tiny "postage stamp" effect.
    if (width >= 1280) return 260;
    if (width >= 1024) return 240;
    if (width >= 768) return 220;
    return 180;
  }, [width]);

  return (
    <View>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-2xl font-extrabold text-gray-900">{title}</Text>
        <Pressable onPress={onOpenAll}>
          <Text className="text-orange-600 text-sm font-bold">Vedi →</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        contentContainerClassName="pl-1 pr-6"
      >
        {pizzas.map((pizza) => (
          <Pressable
            key={pizza.id}
            style={{ width: cardWidth, marginRight: CARD_GAP }}
            className="rounded-2xl overflow-hidden border border-gray-200 active:scale-98 shadow-sm bg-black"
            onPress={() => onOpenPizza(pizza.id)}
          >
            <ImageBackground
              source={{
                uri:
                  pizza.imageUrl ||
                  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
              }}
              className="h-52 w-full justify-end"
              resizeMode="cover"
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                className="px-3 py-2"
              >
                <View className="bg-orange-500 self-start rounded-full px-2 py-0.5 mb-1">
                  <Text className="text-white text-[10px] font-bold">{pizza.badge}</Text>
                </View>
                <Text className="font-extrabold text-white text-base" numberOfLines={1}>
                  {pizza.name}
                </Text>
                <Text className="text-zinc-200 text-[11px]" numberOfLines={2}>
                  {pizza.description}
                </Text>
                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-orange-300 font-extrabold text-lg">€{pizza.price.toFixed(2)}</Text>
                  <Text className="text-xl">{pizza.image}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
            <View className="bg-white px-3 py-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-gray-500">Pronta in 15-20 min</Text>
                {onQuickAddPizza ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      onQuickAddPizza(pizza.id);
                    }}
                    className="w-7 h-7 rounded-full bg-orange-500 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel={`Aggiungi ${pizza.name} al carrello`}
                  >
                    <Text className="text-white text-sm font-extrabold leading-none">+</Text>
                  </Pressable>
                ) : (
                  <Text className="text-xs font-bold text-orange-600">Aggiungi →</Text>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
