/**
 * CategoryFilter Component
 * Filtro per categorie prodotti (horizontal scroll)
 */

import { useAuth } from '@/lib/stores/AuthContext';
import { cn } from '@/lib/utils/cn';
import type { Category } from '@/types';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface CategoryFilterProps {
  readonly categories: Category[];
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (categoryId: string | null) => void;
}

// Helper function to get emoji for category
function getCategoryIcon(categoryName: string): string {
  const name = categoryName.toLowerCase();

  if (name.includes('panin') || name.includes('burger') || name.includes('sandwich')) {
    return '🍔';
  }
  if (name.includes('bevand') || name.includes('drink') || name.includes('bibita')) {
    return '🥤';
  }
  if (name.includes('dolc') || name.includes('dessert') || name.includes('gelat')) {
    return '🍰';
  }
  if (name.includes('pizz')) {
    return '🍕';
  }
  if (name.includes('pasta') || name.includes('primi')) {
    return '🍝';
  }
  if (name.includes('insalat') || name.includes('salad')) {
    return '🥗';
  }
  if (name.includes('antipast') || name.includes('starter')) {
    return '🥙';
  }

  return '🍽️';
}

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryFilterProps) {
  const { isAuthenticated, profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <View className="w-[108px] bg-white h-full border-r border-orange-100">
      <ScrollView
        className="flex-1"
        contentContainerClassName="py-4 gap-4 items-center"
        showsVerticalScrollIndicator={false}
      >
        {/* All Categories */}
        <Pressable
          className={cn(
            'w-20 h-20 rounded-2xl items-center justify-center border',
            selectedCategoryId === null
              ? 'bg-orange-500 border-orange-500 shadow-md'
              : 'bg-orange-50 border-orange-100'
          )}
          onPress={() => onSelectCategory(null)}
        >
          <Text className="text-3xl mb-1">✨</Text>
          <Text
            className={cn(
              'text-xs font-bold text-center',
              selectedCategoryId === null
                ? 'text-white'
                : 'text-orange-700'
            )}
          >
            Tutti
          </Text>
        </Pressable>

        {/* Category Pills */}
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          const icon = getCategoryIcon(category.name);

          return (
            <Pressable
              key={category.id}
              className={cn(
                'w-20 h-20 rounded-2xl items-center justify-center border',
                isSelected
                  ? 'bg-orange-500 border-orange-500 shadow-md'
                  : 'bg-orange-50 border-orange-100'
              )}
              onPress={() => onSelectCategory(category.id)}
            >
              <Text className="text-3xl mb-1">{icon}</Text>
              <Text
                className={cn(
                  'text-xs font-bold text-center px-1',
                  isSelected
                    ? 'text-white'
                    : 'text-orange-700'
                )}
                numberOfLines={1}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Login/Register Button for Guest Users */}
      {!isAuthenticated && (
        <View className="p-3 border-t border-orange-100 bg-white">
          <Pressable
            className="bg-orange-500 rounded-xl py-3 px-2 active:opacity-80"
            onPress={() => router.push('/login')}
          >
            <Text className="text-2xl text-center mb-1">👤</Text>
            <Text className="text-white font-bold text-xs text-center leading-tight">
              Accedi o{'\n'}Registrati
            </Text>
          </Pressable>
        </View>
      )}

      {/* User Info & Logout for Authenticated Users */}
      {isAuthenticated && (
        <View className="p-3 border-t border-orange-100 bg-white gap-2">
          <View className="items-center">
            <View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center mb-2">
              <Text className="text-2xl">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '👤'}
              </Text>
            </View>
            <Text className="text-foreground font-semibold text-xs text-center" numberOfLines={2}>
              {profile?.full_name || 'Utente'}
            </Text>
            <Text className="text-muted-foreground text-xs capitalize">
              {profile?.role || 'Guest'}
            </Text>
          </View>

          <Pressable
            className="bg-destructive/10 rounded-lg py-2 px-2 active:opacity-80 flex-row items-center justify-center gap-2"
            onPress={async () => {
              try {
                await signOut();
                router.replace('/login');
              } catch (error) {
                console.error('Logout error:', error);
              }
            }}
          >
            <Text className="text-xs">🚪</Text>
            <Text className="text-destructive font-bold text-xs">Esci</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
