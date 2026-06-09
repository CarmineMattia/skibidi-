import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, ImageBackground, Pressable, Text, View, useWindowDimensions } from 'react-native';

const ITEM_GAP = 12;

export interface HomeOfferCard {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string;
  includes: string[];
  previewImages?: string[];
}

interface HomeOffersSectionProps {
  readonly offers: HomeOfferCard[];
  readonly onOpenOffer: (offerId: string) => void;
}

export function HomeOffersSection({ offers, onOpenOffer }: HomeOffersSectionProps) {
  const { width } = useWindowDimensions();

  const cardHeight = useMemo(() => {
    if (width < 430) return 182;
    if (width < 900) return 198;
    return 220;
  }, [width]);
  const carouselHeight = cardHeight * 3 + 24;
  const mediaHeight = cardHeight - 46;
  const initialIndex = offers.length > 1 ? 1 : 0;
  const initialSelectedIndex = Math.max(0, Math.min(offers.length - 1, initialIndex + 1));
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

  const getFocusIndex = (offset: number) => {
    const baseIndex = Math.round(offset / (cardHeight + ITEM_GAP));
    const shiftedIndex = baseIndex + 1;
    return Math.max(0, Math.min(offers.length - 1, shiftedIndex));
  };

  if (offers.length === 0) {
    return null;
  }

  return (
    <View className="bg-white/80 border border-[#ead8c7] rounded-3xl p-3.5 shadow-sm gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <FontAwesome name="tags" size={14} color="#8d171e" />
          <Text className="text-[26px] font-black text-gray-900">Offerte del giorno</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-[#8d171e] text-sm font-extrabold">Scorri giu</Text>
          <FontAwesome name="long-arrow-down" size={14} color="#8d171e" />
        </View>
      </View>

      <View className="relative" style={{ height: carouselHeight }}>
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          nestedScrollEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: cardHeight + ITEM_GAP,
            offset: (cardHeight + ITEM_GAP) * index,
            index,
          })}
          snapToInterval={cardHeight + ITEM_GAP}
          decelerationRate="fast"
          snapToAlignment="start"
          onMomentumScrollEnd={(event) => {
            const offset = event.nativeEvent.contentOffset.y;
            const boundedIndex = getFocusIndex(offset);
            setSelectedIndex(boundedIndex);
          }}
          onScroll={(event) => {
            const offset = event.nativeEvent.contentOffset.y;
            const boundedIndex = getFocusIndex(offset);
            if (boundedIndex !== selectedIndex) {
              setSelectedIndex(boundedIndex);
            }
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: ITEM_GAP, paddingBottom: 4 }}
          renderItem={({ item: offer, index }) => {
            const isFeatured = index === selectedIndex;
            return (
            <Pressable
              key={offer.id}
              onPress={() => onOpenOffer(offer.id)}
              style={{
                height: cardHeight,
                transform: [{ scale: isFeatured ? 1 : 0.95 }],
                opacity: isFeatured ? 1 : 0.65,
              }}
              className={`rounded-[22px] overflow-hidden bg-[#efe3d4] active:opacity-90 ${
                isFeatured ? 'border-2 border-[#8d171e] shadow-xl' : 'border border-[#e1a255] shadow-sm'
              }`}
              onPressIn={() => setSelectedIndex(index)}
            >
              <ImageBackground
                source={{ uri: offer.imageUrl }}
                resizeMode="cover"
                style={{ height: mediaHeight }}
                className="justify-end"
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.12)', 'rgba(32,20,14,0.72)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  className="p-3.5"
                >
                  <View className="bg-black/35 self-start rounded-full px-2.5 py-1 mb-1.5">
                    <Text className="text-white text-[10px] font-extrabold">COMBO MEAL</Text>
                  </View>
                  {isFeatured ? (
                    <View className="bg-white/90 self-start rounded-full px-2.5 py-1 mb-1.5">
                      <Text className="text-[#8d171e] text-[10px] font-extrabold">Offerta principale</Text>
                    </View>
                  ) : null}
                  {isFeatured ? (
                    <View className="bg-[#f9ecdd]0/90 self-start rounded-full px-2.5 py-1 mb-1.5">
                      <Text className="text-white text-[10px] font-extrabold">SELEZIONATA</Text>
                    </View>
                  ) : null}
                  <Text className="text-white text-[24px] font-black" numberOfLines={1}>
                    {offer.title}
                  </Text>
                  <Text className="text-[#f3dabb] text-xs mt-0.5" numberOfLines={2}>
                    {offer.subtitle}
                  </Text>
                </LinearGradient>
              </ImageBackground>
              <View className="bg-white border-t border-[#f2e4d6] min-h-[46px] px-3.5 py-3 justify-center">
                <View className="flex-row items-center gap-1.5 mb-1.5">
                  {offer.includes.map((item) => (
                    <View key={item} className="bg-[#f9ecdd] border border-[#e1a255]/40 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-[#8d171e]">{item}</Text>
                    </View>
                  ))}
                </View>
                {offer.previewImages && offer.previewImages.length > 0 ? (
                  <View className="flex-row items-center gap-1 mb-1.5">
                    {offer.previewImages.slice(0, 3).map((previewImage, idx) => (
                      <ImageBackground
                        key={`${offer.id}-preview-${idx}`}
                        source={{ uri: previewImage }}
                        resizeMode="cover"
                        className="w-7 h-7 rounded-full overflow-hidden border border-[#e1a255]/40"
                      />
                    ))}
                    <Text className="text-[10px] text-gray-500 font-semibold">Nel combo</Text>
                  </View>
                ) : null}
                <Text className="text-[#8d171e] font-extrabold">{offer.cta} →</Text>
              </View>
            </Pressable>
            );
          }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['#f9ecdd', 'rgba(253,249,243,0)']}
          className="absolute left-0 right-0 top-0 h-7 rounded-t-2xl"
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(253,249,243,0)', '#f9ecdd']}
          className="absolute left-0 right-0 bottom-0 h-7 rounded-b-2xl"
        />
      </View>
    </View>
  );
}
