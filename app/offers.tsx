/**
 * Pagina Offerte — combo con card verticali scrollabili.
 */

import { OffersList } from '@/components/features/offers/OffersList';
import { SkeletonOffersPage } from '@/components/ui/Skeleton';
import { BRAND } from '@/lib/data/brand';
import type { ResolvedComboOffer } from '@/lib/data/offers';
import { useOffers } from '@/lib/hooks/useOffers';
import { useCart } from '@/lib/stores/CartContext';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function addOfferToCart(offer: ResolvedComboOffer, addItem: ReturnType<typeof useCart>['addItem']) {
  if (offer.products.length === 0) return false;

  offer.products.forEach((product) => {
    addItem(product, 1, `Combo: ${offer.title}`);
  });
  return true;
}

function SectionEyebrow({ children }: { readonly children: string }) {
  return (
    <View className="mb-4 flex-row items-center gap-3">
      <View className="h-px w-8 bg-[#8d171e]" />
      <Text className="text-xs font-black uppercase tracking-[2px] text-[#8d171e]">{children}</Text>
    </View>
  );
}

export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { offers, isLoading, refetch, isRefetching } = useOffers();
  const { addItem } = useCart();
  const isCompact = width < 430;
  const isWide = width >= 768;
  const cardWidth = Math.min(width - (isCompact ? 32 : 40), isWide ? 720 : 680);
  const showSkeleton = isLoading && offers.length === 0;

  const handleSelectOffer = (offer: ResolvedComboOffer) => {
    addOfferToCart(offer, addItem);
    router.push('/(tabs)/menu');
  };

  return (
    <ScrollView
      className="flex-1 bg-[#f9ecdd]"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      <View
        className="border-b border-[#8d171e]/10 bg-[#fff9f1]"
        style={{ paddingTop: insets.top + 8, paddingHorizontal: isCompact ? 16 : 20, paddingBottom: 16 }}
      >
        <View className="w-full max-w-[1240px] self-center gap-5">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full border border-[#ead8c7] bg-white active:opacity-70 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
              accessibilityRole="button"
              accessibilityLabel="Indietro"
            >
              <FontAwesome name="arrow-left" size={16} color="#8d171e" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-black tracking-[-0.5px] text-[#271d19]">Offerte</Text>
              <Text className="text-sm font-bold text-[#8d171e]">{BRAND.name}</Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-full bg-[#8d171e]/10">
              <FontAwesome name="tags" size={18} color="#8d171e" />
            </View>
          </View>

          <View className="max-w-[720px]">
            <SectionEyebrow>Combo del momento</SectionEyebrow>
            <Text
              className={`font-black tracking-[-1.2px] text-[#271d19] ${
                isCompact ? 'text-[30px] leading-[34px]' : 'text-[40px] leading-[44px]'
              }`}
            >
              Scegli il combo giusto per te.
            </Text>
            <Text className="mt-3 text-base leading-7 text-[#65554c]">
              Scorri le offerte, aggiungi al carrello in un tap e completa l’ordine dal menu. Le
              foto mostrano i prodotti reali disponibili oggi.
            </Text>
          </View>
        </View>
      </View>

      <View className={`w-full max-w-[1240px] self-center ${isCompact ? 'px-4 pt-5' : 'px-5 pt-6'}`}>
        {showSkeleton ? (
          <SkeletonOffersPage cardWidth={cardWidth} />
        ) : (
          <View className="gap-6">
            <View className="gap-3">
              <Text className="px-1 text-sm font-bold uppercase tracking-[1.4px] text-[#8d171e]">
                {offers.length} combo disponibili
              </Text>
              <OffersList
                offers={offers}
                onSelectOffer={handleSelectOffer}
                layout="stack"
                cardWidth={cardWidth}
              />
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/menu')}
              className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#8d171e] px-5 active:scale-[0.98] active:opacity-90 web:hover:bg-[#741218] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#e1a255]"
            >
              <FontAwesome name="cutlery" size={16} color="#fff" />
              <Text className="text-base font-extrabold text-white">Esplora il menu completo</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
