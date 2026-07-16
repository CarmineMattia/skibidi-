import { HomeOffersSection } from '@/components/features/home/HomeOffersSection';
import { LandingHeader } from '@/components/features/landing/LandingHeader';
import { LandingHero } from '@/components/features/landing/LandingHero';
import {
  LandingContact,
  LandingGallery,
  LandingServices,
} from '@/components/features/landing/LandingSections';
import { BRAND } from '@/lib/data/brand';
import type { ResolvedComboOffer } from '@/lib/data/offers';
import { useOffers } from '@/lib/hooks/useOffers';
import { useAuth } from '@/lib/stores/AuthContext';
import { useCart } from '@/lib/stores/CartContext';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function addOfferToCart(offer: ResolvedComboOffer, addItem: ReturnType<typeof useCart>['addItem']) {
  if (offer.products.length === 0) return false;
  offer.products.forEach((product) => {
    addItem(product, 1, `Combo: ${offer.title}`);
  });
  return true;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef({ gallery: 0, contact: 0 });
  const [hasHydrated, setHasHydrated] = useState(Platform.OS !== 'web');
  const { width } = useWindowDimensions();
  const viewportWidth = Dimensions.get('window').width;
  const effectiveWidth = Math.min(width, viewportWidth);
  const responsiveWidth = hasHydrated ? effectiveWidth : 390;
  const isCompact = responsiveWidth < 430;
  const isWide = responsiveWidth >= 768;
  const isWebDesktop = Platform.OS === 'web' && isWide;
  const { isAuthenticated, profile } = useAuth();
  const { addItem } = useCart();
  const { offers, refetch, isRefetching, isLoading } = useOffers();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const handleSelectOffer = (offer: ResolvedComboOffer) => {
    addOfferToCart(offer, addItem);
    router.push('/(tabs)/menu');
  };

  const saveSectionOffset =
    (section: keyof typeof sectionOffsets.current) => (event: LayoutChangeEvent) => {
      sectionOffsets.current[section] = event.nativeEvent.layout.y;
    };

  const scrollToSection = (section: keyof typeof sectionOffsets.current) => {
    const stickyHeaderHeight = (isWide ? 78 : 108) + (isWebDesktop ? 0 : insets.top);
    scrollRef.current?.scrollTo({
      y: Math.max(0, sectionOffsets.current[section] - stickyHeaderHeight),
      animated: true,
    });
  };

  return (
    <>
      <Head>
        <title>{`${BRAND.name} | Pizza e consegna a Montecchio Emilia`}</title>
        <meta name="description" content={BRAND.description} />
        <meta property="og:title" content={`${BRAND.name} — ${BRAND.tagline}`} />
        <meta property="og:description" content={BRAND.description} />
      </Head>
      <ScrollView
      ref={scrollRef}
      nativeID="landing-page"
      className="flex-1 bg-[#f9ecdd]"
      contentContainerStyle={{ paddingBottom: isWebDesktop ? 0 : insets.bottom + 88 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <LandingHeader
        isAuthenticated={isAuthenticated}
        isDesktop={isWide}
        topInset={isWebDesktop ? 0 : insets.top}
        onMenu={() => router.push('/(tabs)/menu')}
        onOffers={() => router.push('/offers')}
        onGallery={() => scrollToSection('gallery')}
        onContact={() => scrollToSection('contact')}
        onAccount={() =>
          router.push(isAuthenticated ? '/(tabs)/account' : '/login')
        }
      />

      <LandingHero
        isDesktop={isWide}
        onMenu={() => router.push('/(tabs)/menu')}
        onContact={() => scrollToSection('contact')}
      />

      {isAuthenticated ? (
        <View className="bg-[#8d171e] px-5 py-3">
          <Text className="text-center text-sm font-bold text-white">
            Ciao, {profile?.full_name?.split(' ')[0] || 'cliente'} · il tuo menu è pronto
          </Text>
        </View>
      ) : null}

      <LandingServices
        isDesktop={isWide}
        isCompact={isCompact}
        onMenu={() => router.push('/(tabs)/menu')}
      />

      <View className="bg-[#f1dcc3]">
        <View className="w-full max-w-[1240px] self-center px-5 py-16 sm:px-8 sm:py-24">
          <View className="mb-8 flex-row items-end justify-between gap-4">
            <View className="max-w-[680px] flex-1">
              <View className="mb-4 flex-row items-center gap-3">
                <View className="h-px w-8 bg-[#8d171e]" />
                <Text className="text-xs font-black uppercase tracking-[2px] text-[#8d171e]">
                  Scelte per te
                </Text>
              </View>
              <Text className="font-black tracking-[-1.4px] text-[#271d19] text-[36px] leading-[40px] sm:text-[50px] sm:leading-[54px]">
                Più gusto, insieme.
              </Text>
              <Text className="mt-3 max-w-[520px] text-base leading-7 text-[#65554c]">
                Combo pensati per te: scorri in verticale, scegli e aggiungi al carrello in un tap.
              </Text>
            </View>
          </View>
          <HomeOffersSection
            offers={offers}
            isLoading={isLoading && offers.length === 0}
            isCompact={isCompact}
            onSelectOffer={handleSelectOffer}
            onOpenAll={() => router.push('/offers')}
          />
        </View>
      </View>

      <View onLayout={saveSectionOffset('gallery')}>
        <LandingGallery isDesktop={isWide} isCompact={isCompact} />
      </View>

      <View onLayout={saveSectionOffset('contact')}>
        <LandingContact isDesktop={isWide} isCompact={isCompact} />
      </View>
      </ScrollView>
    </>
  );
}
