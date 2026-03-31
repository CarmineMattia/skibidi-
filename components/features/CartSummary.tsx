/**
 * CartSummary Component
 * Riepilogo carrello (sidebar per tablet/totem)
 */

import { useCart } from '@/lib/stores/CartContext';
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
    <View className="flex-1 bg-white border-l border-orange-100 shadow-2xl">
      {/* Header */}
      <View className="p-5 border-b border-orange-100 bg-[#fff7ed]">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Text className="text-4xl">🛒</Text>
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
        <Text className="text-orange-600 font-extrabold text-lg mt-2">
          {totalItems} {totalItems === 1 ? 'prodotto' : 'prodotti'}
        </Text>
      </View>

      {/* Cart Items */}
      {isEmpty ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="bg-orange-50 rounded-3xl p-12 items-center border border-orange-100">
            <Text className="text-8xl mb-4">🛒</Text>
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
          <View className="p-5 border-t border-orange-100 bg-[#fff7ed] shadow-2xl">
            {/* Total */}
            <View className="bg-orange-100 rounded-2xl p-5 mb-4 border border-orange-200">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-900 font-extrabold text-2xl">
                  Totale
                </Text>
                <Text className="text-orange-700 font-extrabold text-4xl">
                  €{totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Checkout Button */}
            <Pressable
              className="bg-orange-500 rounded-2xl p-5 shadow-xl items-center border border-orange-500"
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
                {!isCheckingOut && <Text className="text-white text-3xl">→</Text>}
              </View>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
