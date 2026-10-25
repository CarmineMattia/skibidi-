/**
 * Striscia "Le nostre pizze" nella hero della home: foto vere delle pizze
 * (Classiche per prime) così chi apre il sito vede subito le pizze.
 * Ogni foto apre il menu. Se i dati non ci sono ancora non mostra nulla.
 */
import { useCategories } from '@/lib/hooks/useCategories';
import { useProducts } from '@/lib/hooks/useProducts';
import { pickHomePizzas } from '@/lib/utils/menuOrder';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

interface HomePizzaStripProps {
  readonly onOpenMenu: () => void;
}

function formatPrice(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `€${amount.toFixed(2)}`;
}

export function HomePizzaStrip({ onOpenMenu }: HomePizzaStripProps) {
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();
  const pizzas = useMemo(() => pickHomePizzas(products, categories, 8), [products, categories]);

  if (pizzas.length === 0) return null;

  return (
    <View className="mt-5" accessibilityLabel="Le nostre pizze">
      <Text className="mb-2.5 text-xs font-black uppercase tracking-[2px] text-[#f3c98e]">Le nostre pizze</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {pizzas.map((pizza) => {
          const price = formatPrice(pizza.price);
          return (
            <Pressable
              key={pizza.id}
              accessibilityRole="button"
              accessibilityLabel={`${pizza.name}: apri il menu`}
              onPress={onOpenMenu}
              className="mr-3 items-center active:opacity-85"
              style={{ width: 92 }}
            >
              <Image
                source={{ uri: pizza.image_url! }}
                resizeMode="cover"
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#e1a255' }}
              />
              <Text className="mt-1.5 text-center text-[13px] font-extrabold text-[#fff8ee]" numberOfLines={1}>
                {pizza.name}
              </Text>
              {price ? <Text className="text-center text-xs font-bold text-[#f3c98e]">{price}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
