/**
 * ProductCard Component
 * Card per visualizzare prodotto in menu (New Design: Full Image + Gradient)
 */

import type { Product } from '@/types/database.types';
import { BUILDER_PRODUCT_NAME, getQuickAddPizzaModifiers } from '@/lib/data/pizzaBuilder';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { useCart } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';

interface ProductCardProps {
  readonly product: Product;
  readonly onAddToCart: (productId: string) => void;
  readonly onPress?: (productId: string) => void;
  readonly onEditPress?: () => void;
  /** Se true, il + rapido aggiunge la pizza in formato Normale. */
  readonly quickAddAsNormalPizza?: boolean;
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

export function ProductCard({ product, onAddToCart, onPress, onEditPress, quickAddAsNormalPizza = false }: ProductCardProps) {
  const { width } = useWindowDimensions();
  const { language } = useAppSettings();
  const { items, addItem, updateQuantity } = useCart();
  const isMobile = width < 768;

  // Only show edit button if onEditPress is provided (which implies admin check in parent)
  const showEditButton = !!onEditPress;
  const needsBuilder = product.name === BUILDER_PRODUCT_NAME;
  const quantityInCart = useMemo(
    () => items.reduce((sum, item) => (item.product.id === product.id ? sum + item.quantity : sum), 0),
    [items, product.id]
  );

  const handleIncrement = useCallback(() => {
    if (needsBuilder) {
      onAddToCart(product.id);
      return;
    }
    if (quickAddAsNormalPizza) {
      addItem(product, 1, '', getQuickAddPizzaModifiers());
      return;
    }
    addItem(product, 1);
  }, [addItem, needsBuilder, onAddToCart, product, quickAddAsNormalPizza]);

  const handleDecrement = useCallback(() => {
    let lastIndex = -1;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].product.id === product.id) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex < 0) return;
    updateQuantity(lastIndex, items[lastIndex].quantity - 1);
  }, [items, product.id, updateQuantity]);

  const handlePress = useCallback(() => {
    onPress?.(product.id);
  }, [onPress, product.id]);

  const icon = getProductIcon(product);
  const formattedPrice = `€${product.price.toFixed(2)}`;

  return (
    <View className="flex-1 rounded-3xl overflow-hidden bg-white border border-[#ead8c7] shadow-sm relative">
      <Pressable
        className={isMobile ? 'h-[58%]' : 'h-[60%]'}
        onPress={handlePress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={
          language === 'en'
            ? `Open ${product.name} details`
            : `Apri dettagli ${product.name}`
        }
      >
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-[#f0daca]">
            <FontAwesome
              name={icon as any}
              size={isMobile ? 46 : 62}
              color="#9ca3af"
            />
          </View>
        )}
      </Pressable>

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
        <Pressable
          onPress={handlePress}
          disabled={!onPress}
          accessibilityRole="button"
        >
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
        </Pressable>

        <View className="mt-auto flex-row items-center justify-between">
          <Pressable onPress={handlePress} disabled={!onPress}>
            <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-black text-[#8d171e]`}>
              {formattedPrice}
            </Text>
          </Pressable>
          <View className="flex-row items-center bg-[#f9ecdd] rounded-full border border-[#e1a255]/60">
            <Pressable
              className={`${isMobile ? 'w-10 h-10' : 'w-11 h-11'} items-center justify-center active:opacity-80`}
              onPress={handleDecrement}
              disabled={quantityInCart <= 0}
              accessibilityRole="button"
              accessibilityLabel={
                language === 'en'
                  ? `Remove one ${product.name}`
                  : `Togli una ${product.name}`
              }
            >
              <FontAwesome name="minus" size={isMobile ? 12 : 13} color={quantityInCart > 0 ? '#8d171e' : '#c4a494'} />
            </Pressable>
            <Text className={`${isMobile ? 'text-sm w-6' : 'text-base w-7'} text-center font-extrabold text-[#8d171e]`}>
              {quantityInCart}
            </Text>
            <Pressable
              className={`${isMobile ? 'w-10 h-10' : 'w-11 h-11'} items-center justify-center bg-[#8d171e] rounded-full active:opacity-90`}
              onPress={handleIncrement}
              accessibilityRole="button"
              accessibilityLabel={
                language === 'en'
                  ? `Add ${product.name} to cart`
                  : `Aggiungi ${product.name} al carrello`
              }
            >
              <FontAwesome name="plus" size={isMobile ? 12 : 13} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
