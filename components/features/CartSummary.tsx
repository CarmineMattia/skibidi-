/**
 * CartSummary Component
 * Riepilogo carrello (sidebar / sheet mobile)
 */

import { useCart } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem } from './CartItem';

interface CartSummaryProps {
  readonly onCheckout?: () => void;
  readonly isCheckingOut?: boolean;
}

export function CartSummary({ onCheckout, isCheckingOut = false }: CartSummaryProps) {
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalAmount } = useCart();
  const [pendingClearAll, setPendingClearAll] = useState(false);

  const isEmpty = items.length === 0;

  useEffect(() => {
    if (isEmpty) setPendingClearAll(false);
  }, [isEmpty]);

  const handleSvuotaTutto = () => {
    if (!pendingClearAll) {
      setPendingClearAll(true);
      return;
    }
    clearCart();
    setPendingClearAll(false);
  };

  return (
    <View className="flex-1 border-l border-[#e1a255]/40 bg-white shadow-2xl">
      <View className="border-b border-[#e1a255]/40 bg-[#f9ecdd] p-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <FontAwesome name="shopping-cart" size={22} color="#111827" />
            <Text className="text-2xl font-extrabold text-gray-900">Carrello</Text>
          </View>
          {!isEmpty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                pendingClearAll ? 'Conferma svuota tutto il carrello' : 'Prepara svuota tutto'
              }
              className={`min-h-[44px] flex-row items-center gap-2 rounded-xl border px-3.5 py-2.5 ${
                pendingClearAll
                  ? 'border-[#8d171e] bg-[#8d171e]'
                  : 'border-destructive/30 bg-destructive/10'
              }`}
              onPress={handleSvuotaTutto}
            >
              {pendingClearAll ? (
                <FontAwesome name="check" size={14} color="#ffffff" />
              ) : (
                <FontAwesome name="trash-o" size={14} color="#8d171e" />
              )}
              <Text
                className={`text-sm font-extrabold ${
                  pendingClearAll ? 'text-white' : 'text-destructive'
                }`}
              >
                {pendingClearAll ? 'Conferma' : 'Svuota tutto'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="mt-2 text-lg font-extrabold text-[#8d171e]">
          {totalItems} {totalItems === 1 ? 'prodotto' : 'prodotti'}
        </Text>
        {pendingClearAll ? (
          <Text className="mt-2 text-xs font-semibold text-[#8d171e]">
            Righe selezionate. Tocca di nuovo «Conferma» per svuotare il carrello.
          </Text>
        ) : null}
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="items-center rounded-3xl border border-[#e1a255]/40 bg-[#f9ecdd] p-12">
            <FontAwesome name="shopping-cart" size={48} color="#9ca3af" style={{ marginBottom: 14 }} />
            <Text className="mb-2 text-center text-2xl font-extrabold text-gray-900">
              Il carrello è vuoto
            </Text>
            <Text className="text-center text-lg text-gray-600">Aggiungi prodotti dal menu</Text>
          </View>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 12 }}>
            {items.map((item, index) => (
              <CartItem
                key={`${item.product.id}-${index}`}
                item={item}
                onUpdateQuantity={(qty) => updateQuantity(index, qty)}
                onRemove={() => removeItem(index)}
                markedForClear={pendingClearAll}
              />
            ))}
          </ScrollView>

          <View
            className="border-t border-[#e1a255]/40 bg-[#f9ecdd] px-5 pt-5 shadow-2xl"
            style={{ paddingBottom: Math.max(20, insets.bottom + 16) }}
          >
            <View className="mb-4 rounded-2xl border border-[#e1a255]/60 bg-[#f3dabb] p-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl font-extrabold text-gray-900">Totale</Text>
                <Text className="text-4xl font-extrabold text-[#8d171e]">
                  €{totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              className="min-h-[72px] items-center justify-center rounded-2xl border border-[#8d171e] bg-[#8d171e] px-6 py-5 shadow-xl active:opacity-80"
              style={{ opacity: isCheckingOut ? 0.5 : 1 }}
              onPress={onCheckout || (() => undefined)}
              disabled={isCheckingOut}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-xl font-extrabold text-white">
                  {isCheckingOut ? 'Elaborazione...' : 'Procedi al Pagamento'}
                </Text>
                {!isCheckingOut ? <FontAwesome name="arrow-right" size={16} color="#ffffff" /> : null}
              </View>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
