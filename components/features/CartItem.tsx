import type { CartItem as CartItemType } from '@/lib/stores/CartContext';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const { product, quantity, notes, modifiers } = item;
  const subtotal = product.price * quantity;

  return (
    <Animated.View
      entering={FadeInRight}
      exiting={FadeOutLeft}
      layout={Layout.springify()}
      className="bg-card rounded-2xl p-4 mb-3 border border-border shadow-sm"
    >
      {/* Product Info */}
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1 mr-2">
          <Text className="text-foreground font-bold text-lg leading-tight">
            {product.name}
          </Text>
          <Text className="text-muted-foreground text-sm mt-1">
            €{product.price.toFixed(2)} cad.
          </Text>

          {/* Modifiers & Notes */}
          {(modifiers && modifiers.length > 0) && (
            <View className="flex-row flex-wrap gap-1 mt-2">
              {modifiers.map((mod, i) => (
                <Text key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md overflow-hidden font-medium">
                  {mod}
                </Text>
              ))}
            </View>
          )}
          {notes ? (
            <Text className="text-xs text-muted-foreground mt-2 italic bg-secondary/30 p-2 rounded-lg">
              📝 "{notes}"
            </Text>
          ) : null}
        </View>

        {/* Remove Button - Larger for boomer accessibility */}
        <Pressable
          onPress={onRemove}
          className="bg-destructive/10 p-3 rounded-full active:bg-destructive/30"
          hitSlop={15}
          accessibilityRole="button"
          accessibilityLabel="Rimuovi prodotto"
        >
          <Text className="text-destructive font-bold text-lg">✕</Text>
        </Pressable>
      </View>

      {/* Quantity Controls & Subtotal */}
      <View className="flex-row justify-between items-center">
        {/* Quantity Controls - Larger for boomer accessibility */}
        <View className="flex-row items-center bg-secondary/50 rounded-xl p-1.5 border border-border/50">
          <Pressable
            onPress={() => onUpdateQuantity(quantity - 1)}
            className="w-12 h-12 items-center justify-center bg-card rounded-lg shadow-sm active:scale-95"
            accessibilityRole="button"
            accessibilityLabel="Diminuisci quantità"
          >
            <Text className="text-foreground font-bold text-2xl leading-none pb-1">−</Text>
          </Pressable>

          <View className="w-14 items-center">
            <Text className="text-foreground font-bold text-xl">
              {quantity}
            </Text>
          </View>

          <Pressable
            onPress={() => onUpdateQuantity(quantity + 1)}
            className="w-12 h-12 items-center justify-center bg-primary rounded-lg shadow-sm active:scale-95"
            accessibilityRole="button"
            accessibilityLabel="Aumenta quantità"
          >
            <Text className="text-primary-foreground font-bold text-2xl leading-none pb-1">+</Text>
          </Pressable>
        </View>

        {/* Subtotal */}
        <Text className="text-primary font-extrabold text-xl">
          €{subtotal.toFixed(2)}
        </Text>
      </View>
    </Animated.View>
  );
}
