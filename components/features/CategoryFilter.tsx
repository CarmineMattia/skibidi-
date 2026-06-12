/**
 * CategoryFilter Component
 * Filtro per categorie prodotti (horizontal scroll)
 */

import { useAuth } from '@/lib/stores/AuthContext';
import { cn } from '@/lib/utils/cn';
import type { Category } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface CategoryFilterProps {
  readonly categories: Category[];
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (categoryId: string | null) => void;
}

// Helper function to get vector icon for category
function getCategoryIcon(categoryName: string): string {
  const name = categoryName.toLowerCase();

  if (name.includes('panin') || name.includes('burger') || name.includes('sandwich')) {
    return 'square';
  }
  if (name.includes('bevand') || name.includes('drink') || name.includes('bibita')) {
    return 'glass';
  }
  if (name.includes('dolc') || name.includes('dessert') || name.includes('gelat')) {
    return 'birthday-cake';
  }
  if (name.includes('pizz')) {
    return 'circle';
  }
  if (name.includes('pasta') || name.includes('primi')) {
    return 'spoon';
  }
  if (name.includes('insalat') || name.includes('salad')) {
    return 'leaf';
  }
  if (name.includes('antipast') || name.includes('starter')) {
    return 'star-o';
  }

  return 'cutlery';
}

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryFilterProps) {
  const { isAuthenticated, profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <View className="w-[108px] bg-white h-full border-r border-[#e1a255]/40">
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
              ? 'bg-[#8d171e] border-[#8d171e] shadow-md'
              : 'bg-[#f9ecdd] border-[#e1a255]/40'
          )}
          onPress={() => onSelectCategory(null)}
        >
          <View className="w-8 h-8 rounded-full bg-white/70 items-center justify-center mb-1">
            <FontAwesome name="th-large" size={13} color={selectedCategoryId === null ? '#8d171e' : '#374151'} />
          </View>
          <Text
            className={cn(
              'text-xs font-bold text-center',
              selectedCategoryId === null
                ? 'text-white'
                : 'text-[#8d171e]'
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
                  ? 'bg-[#8d171e] border-[#8d171e] shadow-md'
                  : 'bg-[#f9ecdd] border-[#e1a255]/40'
              )}
              onPress={() => onSelectCategory(category.id)}
            >
              <View className="w-8 h-8 rounded-full bg-white/70 items-center justify-center mb-1">
                <FontAwesome name={icon as any} size={13} color={isSelected ? '#8d171e' : '#374151'} />
              </View>
              <Text
                className={cn(
                  'text-xs font-bold text-center px-1',
                  isSelected
                    ? 'text-white'
                    : 'text-[#8d171e]'
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
        <View className="p-3 border-t border-[#e1a255]/40 bg-white">
          <Pressable
            className="bg-[#8d171e] rounded-xl py-3 px-2 active:opacity-80"
            onPress={() => router.push('/login')}
          >
            <View className="items-center mb-1">
              <FontAwesome name="user" size={16} color="#ffffff" />
            </View>
            <Text className="text-white font-bold text-xs text-center leading-tight">
              Accedi o{'\n'}Registrati
            </Text>
          </Pressable>
        </View>
      )}

      {/* User Info & Logout for Authenticated Users */}
      {isAuthenticated && (
        <View className="p-3 border-t border-[#e1a255]/40 bg-white gap-2">
          <View className="items-center">
            <View className="w-12 h-12 rounded-full bg-[#f3dabb] items-center justify-center mb-2">
              {profile?.full_name ? (
                <Text className="text-2xl">{profile.full_name.charAt(0).toUpperCase()}</Text>
              ) : (
                <FontAwesome name="user" size={16} color="#8d171e" />
              )}
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
            <FontAwesome name="sign-out" size={11} color="#dc2626" />
            <Text className="text-destructive font-bold text-xs">Esci</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
