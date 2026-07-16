import { OfferCard } from '@/components/features/offers/OfferCard';
import type { ResolvedComboOffer } from '@/lib/data/offers';
import { useMemo, useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';

const ITEM_GAP = 14;

interface OffersCarouselProps {
  readonly offers: ResolvedComboOffer[];
  readonly onSelectOffer: (offer: ResolvedComboOffer) => void;
  readonly variant?: 'compact' | 'full';
}

function CarouselDots({
  count,
  activeIndex,
}: {
  readonly count: number;
  readonly activeIndex: number;
}) {
  if (count <= 1) return null;

  return (
    <View className="mt-3 flex-row items-center justify-center gap-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={`offer-dot-${index}`}
          className={`rounded-full ${
            index === activeIndex ? 'h-2 w-5 bg-[#8d171e]' : 'h-2 w-2 bg-[#8d171e]/20'
          }`}
        />
      ))}
    </View>
  );
}

export function OffersCarousel({ offers, onSelectOffer, variant = 'compact' }: OffersCarouselProps) {
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<ResolvedComboOffer>>(null);
  const isRecenteringRef = useRef(false);

  const cardWidth = useMemo(() => {
    if (variant === 'full') return Math.min(width - 32, 520);
    if (width < 430) return Math.round(width * 0.84);
    if (width < 900) return 360;
    return 400;
  }, [width, variant]);

  const cardHeight = useMemo(() => {
    if (variant === 'full') return 168;
    if (width < 430) return 168;
    return 176;
  }, [width, variant]);

  const supportsInfiniteLoop = offers.length > 1;
  const loopedOffers = useMemo(() => {
    if (!supportsInfiniteLoop) return offers;
    return [...offers, ...offers, ...offers, ...offers, ...offers];
  }, [offers, supportsInfiniteLoop]);

  const centerBlockStart = supportsInfiniteLoop ? offers.length * 2 : 0;
  const initialScrollIndex = centerBlockStart;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const normalizeLoopIndex = (index: number) => {
    if (!supportsInfiniteLoop || offers.length === 0) {
      return Math.max(0, Math.min(offers.length - 1, index));
    }
    return ((index % offers.length) + offers.length) % offers.length;
  };

  const recenterIfNeeded = (offset: number) => {
    if (!supportsInfiniteLoop || offers.length === 0) return offset;
    if (isRecenteringRef.current) return offset;

    const itemSpan = cardWidth + ITEM_GAP;
    const rawIndex = Math.round(offset / itemSpan);
    const normalizedIndex = normalizeLoopIndex(rawIndex);
    const minSafeIndex = offers.length * 0.5;
    const maxSafeIndex = offers.length * 3.5;

    if (rawIndex <= minSafeIndex || rawIndex >= maxSafeIndex) {
      const recenteredIndex = centerBlockStart + normalizedIndex;
      isRecenteringRef.current = true;
      flatListRef.current?.scrollToOffset({ offset: recenteredIndex * itemSpan, animated: false });
      requestAnimationFrame(() => {
        isRecenteringRef.current = false;
      });
      return recenteredIndex * itemSpan;
    }

    return offset;
  };

  const getFocusIndex = (offset: number) => {
    const baseIndex = Math.round(offset / (cardWidth + ITEM_GAP));
    return normalizeLoopIndex(baseIndex);
  };

  if (offers.length === 0) return null;

  return (
    <View>
      <View style={{ height: cardHeight + 4 }}>
        <FlatList
          ref={flatListRef}
          horizontal
          data={loopedOffers}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          nestedScrollEnabled
          initialScrollIndex={initialScrollIndex}
          getItemLayout={(_, index) => ({
            length: cardWidth + ITEM_GAP,
            offset: (cardWidth + ITEM_GAP) * index,
            index,
          })}
          snapToInterval={cardWidth + ITEM_GAP}
          decelerationRate="fast"
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 2, gap: ITEM_GAP }}
          onMomentumScrollEnd={(event) => {
            const effectiveOffset = recenterIfNeeded(event.nativeEvent.contentOffset.x);
            setSelectedIndex(getFocusIndex(effectiveOffset));
          }}
          onScroll={(event) => {
            const effectiveOffset = recenterIfNeeded(event.nativeEvent.contentOffset.x);
            const nextIndex = getFocusIndex(effectiveOffset);
            if (nextIndex !== selectedIndex) setSelectedIndex(nextIndex);
          }}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const sourceIndex = normalizeLoopIndex(index);
            return (
              <OfferCard
                offer={item}
                width={cardWidth}
                height={cardHeight}
                isFeatured={sourceIndex === selectedIndex}
                onPress={() => onSelectOffer(offers[sourceIndex] ?? item)}
              />
            );
          }}
        />
      </View>

      {variant === 'compact' ? (
        <CarouselDots count={offers.length} activeIndex={selectedIndex} />
      ) : null}
    </View>
  );
}
