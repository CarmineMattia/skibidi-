import { getCartItemUnitPrice, type CartItem as CartItemType } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  /** Se true (es. dopo 1° tap su Svuota tutto), mostra il check selezionato */
  readonly markedForClear?: boolean;
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  markedForClear = false,
}: CartItemProps) {
  const { product, quantity, notes, modifiers } = item;
  const unitPrice = getCartItemUnitPrice(item);
  const subtotal = unitPrice * quantity;
  const [pendingRemove, setPendingRemove] = useState(false);

  useEffect(() => {
    if (markedForClear) {
      setPendingRemove(false);
    }
  }, [markedForClear]);

  const showCheck = markedForClear || pendingRemove;

  const handleTrashPress = () => {
    if (markedForClear) {
      // Durante "Svuota tutto" armato, il cestino conferma la rimozione di questa riga
      onRemove();
      return;
    }
    if (!pendingRemove) {
      setPendingRemove(true);
      return;
    }
    onRemove();
  };

  return (
    <Animated.View
      entering={FadeInRight}
      exiting={FadeOutLeft}
      layout={Layout.springify()}
      className={`mb-4 overflow-hidden rounded-2xl border bg-white shadow-sm ${
        showCheck ? 'border-[#8d171e] bg-[#fff5f4]' : 'border-[#ead8c7]'
      }`}
    >
      <View className="flex-row gap-3 p-3.5">
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: '#f0daca',
          }}
        >
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={{ width: 84, height: 84 }}
              resizeMode="cover"
              accessibilityLabel={product.name}
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <FontAwesome name="cutlery" size={28} color="#9ca3af" />
            </View>
          )}
        </View>

        <View className="min-w-0 flex-1 justify-between">
          <View className="flex-row items-start gap-2">
            <View className="min-w-0 flex-1">
              <Text className="text-base font-extrabold leading-5 text-[#271d19]" numberOfLines={2}>
                {product.name}
              </Text>
              <Text className="mt-1 text-sm text-[#8f7068]">€{unitPrice.toFixed(2)} cad.</Text>
            </View>

            <Pressable
              onPress={handleTrashPress}
              accessibilityRole="button"
              accessibilityLabel={
                pendingRemove || markedForClear
                  ? `Conferma elimina ${product.name}`
                  : `Elimina ${product.name}`
              }
              hitSlop={8}
              className={`h-11 w-11 items-center justify-center rounded-full border ${
                showCheck
                  ? 'border-[#8d171e] bg-[#8d171e]'
                  : 'border-[#f3c4c0] bg-[#fff5f4]'
              }`}
            >
              {showCheck ? (
                <FontAwesome name="check" size={16} color="#ffffff" />
              ) : (
                <FontAwesome name="trash-o" size={18} color="#8d171e" />
              )}
            </Pressable>
          </View>

          {modifiers && modifiers.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap gap-1.5">
              {modifiers.map((mod, i) => (
                <View key={`${mod}-${i}`} className="rounded-lg bg-[#8d171e]/10 px-2 py-1">
                  <Text className="text-[11px] font-semibold text-[#8d171e]">{mod}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {notes ? (
            <Text className="mt-2 rounded-lg bg-[#f9ecdd] px-2 py-1.5 text-xs italic text-[#65554c]">
              {`📝 "${notes}"`}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center justify-between border-t border-[#f2e4d6] px-3.5 py-3">
        <View className="flex-row items-center gap-1 rounded-2xl border border-[#ead8c7] bg-[#f9ecdd] p-1">
          <Pressable
            onPress={() => onUpdateQuantity(quantity - 1)}
            accessibilityRole="button"
            accessibilityLabel={`Togli una ${product.name}`}
            className="h-12 w-12 items-center justify-center rounded-xl bg-white active:opacity-80"
          >
            <Text className="text-2xl font-bold leading-none text-[#271d19]">−</Text>
          </Pressable>

          <View className="min-w-[44px] items-center px-1">
            <Text className="text-lg font-extrabold text-[#271d19]">{quantity}</Text>
          </View>

          <Pressable
            onPress={() => onUpdateQuantity(quantity + 1)}
            accessibilityRole="button"
            accessibilityLabel={`Aggiungi una ${product.name}`}
            className="h-12 w-12 items-center justify-center rounded-xl bg-[#8d171e] active:opacity-80"
          >
            <Text className="text-2xl font-bold leading-none text-white">+</Text>
          </Pressable>
        </View>

        <Text className="text-xl font-black text-[#8d171e]">€{subtotal.toFixed(2)}</Text>
      </View>
    </Animated.View>
  );
}
