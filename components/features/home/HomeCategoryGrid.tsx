import type { HomeCategory } from '@/components/features/home/types';
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
  return (
    <View>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-extrabold text-gray-900">📋 Categorie</Text>
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
            <Text className="text-3xl mb-1">{cat.icon}</Text>
            <Text className="text-[11px] font-extrabold text-center text-gray-900">{cat.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
