/**
 * ProductCard Component
 * Card per visualizzare prodotto in menu (New Design: Full Image + Gradient)
 */

import { useAuth } from '@/lib/stores/AuthContext';
import type { Product } from '@/types/database.types';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  onEditPress?: () => void;
}

// Helper function to get emoji icon based on product name
function getProductIcon(product: Product): string {
  const name = product.name.toLowerCase();

  // Product name-based icons
  if (name.includes('hamburger') || name.includes('burger') || name.includes('panino')) return '🍔';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('pasta') || name.includes('spaghetti')) return '🍝';
  if (name.includes('insalata') || name.includes('salad')) return '🥗';
  if (name.includes('caffe') || name.includes('coffee')) return '☕';
  if (name.includes('acqua') || name.includes('water')) return '💧';
  if (name.includes('coca') || name.includes('cola') || name.includes('bibita')) return '🥤';
  if (name.includes('birra') || name.includes('beer')) return '🍺';
  if (name.includes('vino') || name.includes('wine')) return '🍷';
  if (name.includes('patatine') || name.includes('fries')) return '🍟';
  if (name.includes('gelato') || name.includes('ice cream')) return '🍦';
  if (name.includes('tiramisu')) return '🍮';
  if (name.includes('torta') || name.includes('cake')) return '🍰';
  if (name.includes('dolce') || name.includes('dessert')) return '🧁';

  // Default icon
  return '🍽️';
}

export function ProductCard({ product, onAddToCart, onEditPress }: ProductCardProps) {
  const { userRole, isKioskMode } = useAuth();

  // Only show edit button if onEditPress is provided (which implies admin check in parent)
  const showEditButton = !!onEditPress;

  const handleAddToCart = useCallback(() => {
    onAddToCart(product.id);
  }, [product.id, onAddToCart]);

  const icon = getProductIcon(product);
  const formattedPrice = `€${product.price.toFixed(2)}`;

  return (
    <View className="flex-1 rounded-2xl md:rounded-[30px] overflow-hidden bg-secondary/80 relative shadow-md">
      {/* Background Image - Absolute */}
      {product.image_url ? (
        <Image
          source={{ uri: product.image_url }}
          className="absolute top-0 left-0 right-0 bottom-0 w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <View className="absolute top-0 left-0 right-0 bottom-0 w-full h-full items-center justify-center bg-zinc-800">
          <Text className="text-6xl md:text-8xl opacity-80">{icon}</Text>
        </View>
      )}

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.4, 1]}
        className="absolute top-0 left-0 right-0 bottom-0 h-full w-full"
      />

      {/* Admin Edit Button */}
      {showEditButton && (
        <Pressable
          className="absolute top-3 right-3 bg-black/40 p-3 rounded-full z-20 backdrop-blur-sm active:bg-black/60"
          onPress={(e) => {
            e.stopPropagation();
            onEditPress?.();
          }}
        >
          <FontAwesome name="pencil" size={16} color="white" />
        </Pressable>
      )}

      {/* Content Container - Pushed to bottom */}
      <View className="flex-1 justify-end p-5">

        {/* Text Content */}
        <View className="mb-3 md:mb-4">
          <Text className="text-white font-bold text-xl md:text-2xl mb-1 md:mb-2 drop-shadow-sm leading-tight">
            {product.name}
          </Text>

          {(product.description || product.ingredients) && (
            <Text className="text-zinc-200 text-sm font-medium leading-5 opacity-90" numberOfLines={3}>
              {product.description || product.ingredients?.join(', ')}
            </Text>
          )}
        </View>

        <Pressable
          className="bg-white py-3.5 px-5 md:py-4 md:px-7 rounded-full items-center justify-center active:scale-95 transition-transform"
          onPress={handleAddToCart}
          accessibilityRole="button"
          accessibilityLabel={`Aggiungi ${product.name} al carrello`}
        >
          <Text className="text-black font-extrabold text-base md:text-lg tracking-wide">
            Aggiungi {formattedPrice}
          </Text>
        </Pressable>

      </View>
    </View>
  );
}
