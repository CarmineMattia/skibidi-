import { OfferCard } from '@/components/features/offers/OfferCard';
import type { OfferCardLayout } from '@/components/features/offers/OfferCard';
import type { ResolvedComboOffer } from '@/lib/data/offers';
import { FlatList, View, useWindowDimensions } from 'react-native';

const ITEM_GAP = 16;

interface OffersListProps {
  readonly offers: ResolvedComboOffer[];
  readonly onSelectOffer: (offer: ResolvedComboOffer) => void;
  readonly layout?: OfferCardLayout;
  readonly limit?: number;
  readonly scrollable?: boolean;
  readonly maxHeight?: number;
  readonly cardWidth?: number;
}

export function OffersList({
  offers,
  onSelectOffer,
  layout = 'stack',
  limit,
  scrollable = false,
  maxHeight,
  cardWidth,
}: OffersListProps) {
  const { width } = useWindowDimensions();
  const resolvedCardWidth = cardWidth ?? Math.min(width - 40, 680);
  const visibleOffers = limit ? offers.slice(0, limit) : offers;

  if (visibleOffers.length === 0) return null;

  const renderCard = (offer: ResolvedComboOffer) => (
    <OfferCard
      offer={offer}
      layout={layout}
      width={resolvedCardWidth}
      height={layout === 'row' ? 168 : undefined}
      isFeatured
      onPress={() => onSelectOffer(offer)}
    />
  );

  if (scrollable && maxHeight) {
    return (
      <FlatList
        data={visibleOffers}
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ maxHeight }}
        ItemSeparatorComponent={() => <View style={{ height: ITEM_GAP }} />}
        renderItem={({ item }) => renderCard(item)}
      />
    );
  }

  return (
    <View style={{ gap: ITEM_GAP }}>
      {visibleOffers.map((offer) => (
        <View key={offer.id}>{renderCard(offer)}</View>
      ))}
    </View>
  );
}
