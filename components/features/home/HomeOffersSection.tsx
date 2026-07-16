import { OffersList } from '@/components/features/offers/OffersList';
import { SkeletonHomeOffers } from '@/components/ui/Skeleton';
import type { ResolvedComboOffer } from '@/lib/data/offers';
import { FontAwesome } from '@expo/vector-icons';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

interface HomeOffersSectionProps {
  readonly offers: ResolvedComboOffer[];
  readonly onSelectOffer: (offer: ResolvedComboOffer) => void;
  readonly onOpenAll?: () => void;
  readonly isLoading?: boolean;
  readonly isCompact?: boolean;
}

const HOME_SCROLLABLE_MIN = 3;

export function HomeOffersSection({
  offers,
  onSelectOffer,
  onOpenAll,
  isLoading = false,
  isCompact = false,
}: HomeOffersSectionProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 680);
  const previewHeight = isCompact ? 640 : 720;
  const useNestedScroll = offers.length >= HOME_SCROLLABLE_MIN;

  if (isLoading) {
    return <SkeletonHomeOffers isCompact={isCompact} cardWidth={cardWidth} />;
  }

  if (offers.length === 0) return null;

  return (
    <View className="gap-4">
      <OffersList
        offers={offers}
        onSelectOffer={onSelectOffer}
        layout="stack"
        scrollable={useNestedScroll}
        maxHeight={useNestedScroll ? previewHeight : undefined}
        cardWidth={cardWidth}
      />

      {onOpenAll ? (
        <Pressable
          accessibilityRole="link"
          onPress={onOpenAll}
          className="self-start flex-row items-center gap-1.5 rounded-lg px-1 py-1 active:opacity-70 web:hover:opacity-80 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
        >
          <Text className="text-sm font-extrabold text-[#8d171e]">
            Apri pagina offerte ({offers.length})
          </Text>
          <FontAwesome name="long-arrow-right" size={12} color="#8d171e" />
        </Pressable>
      ) : null}
    </View>
  );
}

export type { ResolvedComboOffer as HomeOfferCard };
