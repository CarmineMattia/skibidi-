/**
 * ProductCard Component
 * Card per visualizzare prodotto in menu (New Design: Full Image + Gradient)
 */

import type { Product } from '@/types/database.types';
import { FontAwesome } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';

interface ProductCardProps {
  readonly product: Product;
  readonly onAddToCart: (productId: string) => void;
  readonly onEditPress?: () => void;
}

// Helper function to get icon name based on product name
function getProductIcon(product: Product): string {
  const name = product.name.toLowerCase();

  // Product name-based icons
  if (name.includes('hamburger') || name.includes('burger') || name.includes('panino')) return 'square';
  if (name.includes('pizza')) return 'circle';
  if (name.includes('pasta') || name.includes('spaghetti')) return 'spoon';
  if (name.includes('insalata') || name.includes('salad')) return 'leaf';
  if (name.includes('caffe') || name.includes('coffee')) return 'coffee';
  if (name.includes('acqua') || name.includes('water')) return 'tint';
  if (name.includes('coca') || name.includes('cola') || name.includes('bibita')) return 'glass';
  if (name.includes('birra') || name.includes('beer')) return 'beer';
  if (name.includes('vino') || name.includes('wine')) return 'glass';
  if (name.includes('patatine') || name.includes('fries')) return 'bookmark';
  if (name.includes('gelato') || name.includes('ice cream')) return 'snowflake-o';
  if (name.includes('tiramisu')) return 'star-o';
  if (name.includes('torta') || name.includes('cake')) return 'birthday-cake';
  if (name.includes('dolce') || name.includes('dessert')) return 'heart-o';

  // Default icon
  return 'cutlery';
}

export function ProductCard({ product, onAddToCart, onEditPress }: ProductCardProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Only show edit button if onEditPress is provided (which implies admin check in parent)
  const showEditButton = !!onEditPress;

  const handleAddToCart = useCallback(() => {
    onAddToCart(product.id);
  }, [product.id, onAddToCart]);

  const icon = getProductIcon(product);
  const formattedPrice = `€${product.price.toFixed(2)}`;

  return (
    <View className="flex-1 rounded-3xl overflow-hidden bg-white border border-[#ead8c7] shadow-sm relative">
      <View className={isMobile ? 'h-[58%]' : 'h-[60%]'}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-[#f7efe3]">
            <FontAwesome
              name={icon as any}
              size={isMobile ? 46 : 62}
              color="#9ca3af"
            />
          </View>
        )}
      </View>

      {/* Admin Edit Button */}
      {showEditButton && (
        <Pressable
          className={`absolute z-20 rounded-full bg-black/45 active:bg-black/60 ${
            isMobile ? 'top-2 right-2 p-2' : 'top-3 right-3 p-3'
          }`}
          onPress={(e) => {
            e.stopPropagation();
            onEditPress?.();
          }}
        >
          <FontAwesome name="pencil" size={isMobile ? 14 : 16} color="white" />
        </Pressable>
      )}

      <View className={isMobile ? 'flex-1 px-4 py-3' : 'flex-1 px-4 py-4'}>
        <Text className="text-[11px] font-bold uppercase tracking-wide text-[#8f7068]">Classic</Text>
        <Text
          className={`text-gray-900 font-extrabold leading-tight ${
            isMobile ? 'text-lg mt-0.5' : 'text-xl mt-1'
          }`}
          numberOfLines={1}
        >
          {product.name}
        </Text>

        {(product.description || product.ingredients) && (
          <Text
            className={`text-gray-600 ${isMobile ? 'text-xs mt-1' : 'text-sm mt-1.5'}`}
            numberOfLines={2}
          >
            {product.description || product.ingredients?.join(', ')}
          </Text>
        )}

        <View className="mt-auto flex-row items-center justify-between">
          <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-black text-[#d4451a]`}>
            {formattedPrice}
          </Text>
          <Pressable
            className={`bg-[#d4451a] rounded-full items-center justify-center active:opacity-90 ${
              isMobile ? 'h-10 px-4' : 'h-11 px-5'
            }`}
            onPress={handleAddToCart}
            accessibilityRole="button"
            accessibilityLabel={`Aggiungi ${product.name} al carrello`}
          >
            <Text className={`text-white font-extrabold ${isMobile ? 'text-sm' : 'text-base'}`}>
              add
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
