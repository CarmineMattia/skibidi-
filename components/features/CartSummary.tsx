/**
 * CartSummary Component
 * Riepilogo carrello (sidebar per tablet/totem)
 */

import { useCart } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CartItem } from './CartItem';

interface CartSummaryProps {
  readonly onCheckout?: () => void;
  readonly isCheckingOut?: boolean;
}

export function CartSummary({ onCheckout, isCheckingOut = false }: CartSummaryProps) {
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalAmount } = useCart();

  const isEmpty = items.length === 0;

  return (
    <View className="flex-1 bg-white border-l border-[#e1a255]/40 shadow-2xl">
      {/* Header */}
      <View className="p-5 border-b border-[#e1a255]/40 bg-[#f9ecdd]">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <FontAwesome name="shopping-cart" size={22} color="#111827" />
            <Text className="text-gray-900 font-extrabold text-2xl">
              Carrello
            </Text>
          </View>
          {!isEmpty && (
            <Pressable
              className="bg-destructive/10 px-4 py-2 rounded-xl border border-destructive/30"
              onPress={clearCart}
            >
              <Text className="text-destructive font-extrabold text-sm">Svuota</Text>
            </Pressable>
          )}
        </View>
        <Text className="text-[#8d171e] font-extrabold text-lg mt-2">
          {totalItems} {totalItems === 1 ? 'prodotto' : 'prodotti'}
        </Text>
      </View>

      {/* Cart Items */}
      {isEmpty ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="bg-[#f9ecdd] rounded-3xl p-12 items-center border border-[#e1a255]/40">
            <FontAwesome name="shopping-cart" size={48} color="#9ca3af" style={{ marginBottom: 14 }} />
            <Text className="text-gray-900 font-extrabold text-2xl text-center mb-2">
              Il carrello è vuoto
            </Text>
            <Text className="text-gray-600 text-center text-lg">
              Aggiungi prodotti dal menu
            </Text>
          </View>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1 p-4">
            {items.map((item, index) => (
              <CartItem
                key={`${item.product.id}-${index}`}
                item={item}
                onUpdateQuantity={(qty) => updateQuantity(index, qty)}
                onRemove={() => removeItem(index)}
              />
            ))}
          </ScrollView>

          {/* Footer with Total & Checkout */}
          <View className="p-5 border-t border-[#e1a255]/40 bg-[#f9ecdd] shadow-2xl">
            {/* Total */}
            <View className="bg-[#f3dabb] rounded-2xl p-5 mb-4 border border-[#e1a255]/60">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-900 font-extrabold text-2xl">
                  Totale
                </Text>
                <Text className="text-[#8d171e] font-extrabold text-4xl">
                  €{totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Checkout Button */}
            <Pressable
              className="bg-[#8d171e] rounded-2xl p-5 shadow-xl items-center border border-[#8d171e]"
              style={{
                opacity: isCheckingOut ? 0.5 : 1,
              }}
              onPress={onCheckout || (() => console.log('Checkout!'))}
              disabled={isCheckingOut}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-white font-extrabold text-xl">
                  {isCheckingOut ? 'Elaborazione...' : 'Procedi al Pagamento'}
                </Text>
                {!isCheckingOut && <FontAwesome name="arrow-right" size={16} color="#ffffff" />}
              </View>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
