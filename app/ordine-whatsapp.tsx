import { Button } from '@/components/ui/Button';
import { useCategories } from '@/lib/hooks/useCategories';
import { useHydratedSearchParams } from '@/lib/hooks/useHydrated';
import { useProducts } from '@/lib/hooks/useProducts';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import { useTenant } from '@/lib/stores/TenantContext';
import { consumeWhatsAppOrder, parseWhatsAppOrder, rememberWhatsAppOrder, resolveWhatsAppOrder } from '@/lib/utils/whatsappOrder';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

export default function WhatsAppOrder() {
  const { righe } = useHydratedSearchParams<{ righe?: string | string[] }>();
  const requestedLines = parseWhatsAppOrder(righe);
  const router = useRouter();
  const { items, replaceCart } = useCart();
  const { isAuthenticated, isLoading: authLoading, signInWithOAuth } = useAuth();
  const { isLoading: tenantLoading } = useTenant();
  const products = useProducts();
  const categories = useCategories();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(false);
  const loading = tenantLoading || products.isPending || categories.isPending;
  const unavailable = products.isError || categories.isError;
  const draft = requestedLines && products.data && categories.data
    ? resolveWhatsAppOrder(requestedLines, products.data, categories.data)
    : null;

  async function continueOrder() {
    if (!draft || typeof righe !== 'string') return;
    if (isAuthenticated) {
      replaceCart(draft);
      router.replace('/one-screen-checkout');
      return;
    }

    setSigningIn(true);
    setSignInError(false);
    rememberWhatsAppOrder(righe);
    try {
      await signInWithOAuth('google');
    } catch {
      consumeWhatsAppOrder();
      setSignInError(true);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      <View className="mx-auto w-full max-w-xl gap-4 rounded-xl border border-border bg-card p-5">
        <Text className="text-2xl font-bold text-card-foreground">Carrello da WhatsApp</Text>
        {!requestedLines ? (
          <Text className="text-muted-foreground">Il link del carrello non è valido.</Text>
        ) : unavailable ? (
          <Text className="text-muted-foreground">Il menu non è raggiungibile. Ricarica la pagina per riprovare.</Text>
        ) : loading ? (
          <ActivityIndicator accessibilityLabel="Caricamento del menu" />
        ) : !draft ? (
          <Text className="text-muted-foreground">Uno o più prodotti richiedono una nuova scelta dal menu.</Text>
        ) : (
          <>
            {draft.map(({ product, quantity }) => (
              <View key={product.id} className="flex-row justify-between gap-3">
                <Text className="flex-1 text-card-foreground">{quantity}× {product.name}</Text>
                <Text className="text-card-foreground">{euros.format(product.price * quantity)}</Text>
              </View>
            ))}
            <View className="flex-row justify-between border-t border-border pt-3">
              <Text className="font-semibold text-card-foreground">Totale prodotti</Text>
              <Text className="font-semibold text-card-foreground">
                {euros.format(draft.reduce((total, item) => total + item.product.price * item.quantity, 0))}
              </Text>
            </View>
            {items.length > 0 && (
              <Text className="text-muted-foreground">Continuando sostituirai il carrello già aperto.</Text>
            )}
            {signInError && (
              <Text accessibilityRole="alert" className="text-destructive">Accesso non riuscito. Riprova con Google.</Text>
            )}
            <Button
              title={isAuthenticated ? 'Continua al checkout' : 'Accedi con Google per continuare'}
              disabled={authLoading || signingIn || products.isFetching || categories.isFetching}
              onPress={continueOrder}
            />
          </>
        )}
        <Button title="Apri il menu" variant="outline" onPress={() => router.replace('/(tabs)/menu')} />
      </View>
    </ScrollView>
  );
}
