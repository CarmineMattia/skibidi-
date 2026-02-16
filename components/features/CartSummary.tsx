/**
 * CartSummary Component
 * Riepilogo carrello (sidebar per tablet/totem)
 */

import { useCart } from '@/lib/stores/CartContext';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { CartItem } from './CartItem';

interface CartSummaryProps {
  onCheckout?: () => void;
  isCheckingOut?: boolean;
}

export function CartSummary({ onCheckout, isCheckingOut = false }: CartSummaryProps) {
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalAmount } = useCart();

  const isEmpty = items.length === 0;

  return (
    <View className="flex-1 bg-card border-l-4 border-primary/20 shadow-2xl">
      {/* Header */}
      <View className="p-5 border-b-2 border-primary/20 bg-secondary/30">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Text className="text-4xl">🛒</Text>
            <Text className="text-foreground font-extrabold text-2xl">
              Carrello
            </Text>
          </View>
          {!isEmpty && (
            <Pressable
              className="bg-destructive/10 px-6 py-4 rounded-xl border border-destructive/30 active:opacity-70"
              onPress={clearCart}
            >
              <Text className="text-destructive font-extrabold text-lg">Svuota</Text>
            </Pressable>
          )}
        </View>
        <Text className="text-primary font-extrabold text-lg mt-2">
          {totalItems} {totalItems === 1 ? 'prodotto' : 'prodotti'}
        </Text>
      </View>

      {/* Cart Items */}
      {isEmpty ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="bg-muted/50 rounded-3xl p-12 items-center border-2 border-muted">
            <Text className="text-8xl mb-4">🛒</Text>
            <Text className="text-foreground font-extrabold text-2xl text-center mb-2">
              Il carrello è vuoto
            </Text>
            <Text className="text-muted-foreground text-center text-lg">
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
          <View className="p-5 border-t-4 border-primary/20 bg-secondary/20 shadow-2xl">
            {/* Total */}
            <View className="bg-primary/10 rounded-2xl p-5 mb-4 border-2 border-primary/30">
              <View className="flex-row justify-between items-center">
                <Text className="text-foreground font-extrabold text-2xl">
                  Totale
                </Text>
                <Text className="text-primary font-extrabold text-4xl">
                  €{totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Checkout Button */}
            <Pressable
              className="bg-primary rounded-2xl p-5 shadow-xl items-center justify-center border-2 border-primary"
              style={{
                opacity: isCheckingOut ? 0.5 : 1,
                minHeight: 56,
              }}
              onPress={onCheckout || (() => console.log('Checkout!'))}
              disabled={isCheckingOut}
            >
              <View className="flex-row items-center gap-3">
                {isCheckingOut ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-primary-foreground font-extrabold text-xl">
                      Elaborazione...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-primary-foreground font-extrabold text-xl">
                      Procedi al Pagamento
                    </Text>
                    <Text className="text-primary-foreground text-3xl">→</Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
