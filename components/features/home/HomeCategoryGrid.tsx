import type { HomeCategory } from '@/components/features/home/types';
import { FontAwesome } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

interface HomeCategoryGridProps {
  readonly categories: HomeCategory[];
  readonly onOpenAll: () => void;
  readonly onOpenCategory: (categoryId: number) => void;
}

export function HomeCategoryGrid({
  categories,
  onOpenAll,
  onOpenCategory,
}: HomeCategoryGridProps) {
  const getCategoryIconName = (categoryName: string): string => {
    const normalized = categoryName.toLowerCase();
    if (normalized.includes('pizza')) return 'circle';
    if (normalized.includes('burger') || normalized.includes('panin')) return 'square';
    if (normalized.includes('insalat')) return 'leaf';
    if (normalized.includes('dolc') || normalized.includes('dessert')) return 'birthday-cake';
    if (normalized.includes('bevand') || normalized.includes('drink')) return 'glass';
    return 'cutlery';
  };

  return (
    <View>
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-2">
          <FontAwesome name="th-large" size={14} color="#4b5563" />
          <Text className="text-lg font-extrabold text-gray-900">Categorie</Text>
        </View>
        <Pressable onPress={onOpenAll}>
          <Text className="text-orange-600 text-xs font-bold">Vedi →</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-3 justify-start">
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            className={`${cat.color} rounded-2xl border border-white p-3 w-[92px] items-center active:scale-95 shadow-sm`}
            onPress={() => onOpenCategory(cat.id)}
          >
            <View className="w-8 h-8 rounded-full bg-white/70 items-center justify-center mb-1">
              <FontAwesome name={getCategoryIconName(cat.name) as any} size={14} color="#374151" />
            </View>
            <Text className="text-[11px] font-extrabold text-center text-gray-900">{cat.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
