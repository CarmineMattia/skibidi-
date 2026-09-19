import { cn } from '@/lib/utils/cn';
import type { Category } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

interface MobileCategoryBarProps {
  readonly categories: Category[];
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (categoryId: string | null) => void;
  readonly searchQuery: string;
  readonly onChangeSearch: (value: string) => void;
  /** image_url preferita per categoria (es. primo prodotto) */
  readonly categoryImages?: Record<string, string | undefined>;
}

const FALLBACK_BY_NAME: Record<string, string> = {
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=200&q=70',
  bianc: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=200&q=70',
  metro: 'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?auto=format&fit=crop&w=200&q=70',
  bevand: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=200&q=70',
  dolc: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=200&q=70',
  frit: 'https://images.unsplash.com/photo-1630384066600-4f4f0c5b1b1a?auto=format&fit=crop&w=200&q=70',
  default:
    'https://images.unsplash.com/photo-1548369937-47519962c11a?auto=format&fit=crop&w=200&q=70',
};

function fallbackImageForCategory(name: string): string {
  const n = name.toLowerCase();
  for (const [key, url] of Object.entries(FALLBACK_BY_NAME)) {
    if (key !== 'default' && n.includes(key)) return url;
  }
  return FALLBACK_BY_NAME.default;
}

function CategoryChip({
  label,
  selected,
  imageUrl,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly imageUrl: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'mr-2.5 items-center rounded-2xl border px-2.5 py-2 active:opacity-85',
        selected ? 'border-[#8d171e] bg-[#8d171e]' : 'border-[#ead8c7] bg-white'
      )}
      style={{ minWidth: 76 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: '#f0daca',
          marginBottom: 6,
          borderWidth: selected ? 2 : 0,
          borderColor: '#f3c98e',
        }}
      >
        <Image source={{ uri: imageUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
      </View>
      <Text
        className={cn('text-center text-[11px] font-extrabold', selected ? 'text-white' : 'text-[#8d171e]')}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Barra mobile fissa: ricerca + categorie con miniatura.
 * Va fuori dalla FlatList così resta visibile durante lo scroll.
 */
export function MobileCategoryBar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onChangeSearch,
  categoryImages = {},
}: MobileCategoryBarProps) {
  return (
    <View className="z-20 border-b border-[#ead8c7] bg-[#fff9f1] px-3 pb-2.5 pt-2">
      <View className="mb-2.5 flex-row items-center gap-2 rounded-2xl border border-[#ead8c7] bg-white px-3 py-2.5">
        <FontAwesome name="search" size={15} color="#8f7068" />
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearch}
          placeholder="Cerca pizza, bevanda..."
          placeholderTextColor="#b09a90"
          className="min-h-[28px] flex-1 text-base font-semibold text-[#271d19]"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => onChangeSearch('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Pulisci ricerca"
          >
            <FontAwesome name="times-circle" size={16} color="#8f7068" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        <CategoryChip
          label="Solo mangiare"
          selected={selectedCategoryId === null && searchQuery.trim().length === 0}
          imageUrl={FALLBACK_BY_NAME.pizza}
          onPress={() => {
            onChangeSearch('');
            onSelectCategory(null);
          }}
        />
        {categories.map((category) => {
          const imageUrl =
            categoryImages[category.id] || fallbackImageForCategory(category.name);
          return (
            <CategoryChip
              key={category.id}
              label={category.name}
              selected={selectedCategoryId === category.id}
              imageUrl={imageUrl}
              onPress={() => {
                onChangeSearch('');
                onSelectCategory(category.id);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
