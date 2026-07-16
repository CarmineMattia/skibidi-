import type { ResolvedComboOffer } from '@/lib/data/offers';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, ImageBackground, Pressable, Text, View } from 'react-native';

export type OfferCardLayout = 'row' | 'stack';

interface OfferCardProps {
  readonly offer: ResolvedComboOffer;
  readonly onPress: () => void;
  readonly layout?: OfferCardLayout;
  readonly width?: number;
  readonly height?: number;
  readonly isFeatured?: boolean;
}

function ComboBadge() {
  return (
    <View className="self-start rounded-md bg-[#8d171e] px-2 py-0.5">
      <Text className="text-[9px] font-extrabold tracking-wide text-white">COMBO</Text>
    </View>
  );
}

function OfferIncludes({ items }: { readonly items: string[] }) {
  if (items.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-1">
      {items.slice(0, 3).map((item) => (
        <View key={item} className="rounded bg-[#f9ecdd] px-1.5 py-0.5">
          <Text className="text-[9px] font-bold text-[#8d171e]">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function OfferPrice({
  price,
  originalPrice,
  size = 'md',
}: {
  readonly price: number;
  readonly originalPrice: number;
  readonly size?: 'md' | 'lg';
}) {
  if (price <= 0) return null;

  return (
    <View className="flex-row items-baseline gap-1.5">
      <Text
        className={`font-black text-[#8d171e] ${size === 'lg' ? 'text-2xl leading-7' : 'text-lg'}`}
      >
        €{price.toFixed(2)}
      </Text>
      {originalPrice > price ? (
        <Text className="text-xs text-[#9a8778] line-through">€{originalPrice.toFixed(2)}</Text>
      ) : null}
    </View>
  );
}

function OfferPreviewImages({ offer }: { readonly offer: ResolvedComboOffer }) {
  if (offer.previewImages.length === 0) return null;

  return (
    <View className="flex-row items-center gap-1.5">
      {offer.previewImages.slice(0, 4).map((uri, idx) => (
        <Image
          key={`${offer.id}-thumb-${idx}`}
          source={{ uri }}
          className="h-8 w-8 rounded-lg border border-[#ead8c7] bg-[#f9ecdd]"
        />
      ))}
    </View>
  );
}

function AddButton({ size = 'md' }: { readonly size?: 'md' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const iconSize = size === 'lg' ? 15 : 13;

  return (
    <View className={`${dimension} items-center justify-center rounded-full bg-[#8d171e]`}>
      <FontAwesome name="plus" size={iconSize} color="#fff" />
    </View>
  );
}

function StackOfferCard({
  offer,
  width,
  isFeatured,
  onPress,
}: {
  readonly offer: ResolvedComboOffer;
  readonly width?: number;
  readonly isFeatured: boolean;
  readonly onPress: () => void;
}) {
  const imageHeight = width && width >= 560 ? 208 : 184;
  const savings =
    offer.originalPrice > offer.price ? offer.originalPrice - offer.price : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        offer.price > 0 ? `${offer.title}, €${offer.price.toFixed(2)}` : offer.title
      }
      accessibilityHint="Aggiunge il combo al carrello e apre il menu"
      onPress={onPress}
      style={width ? { width } : undefined}
      className={`overflow-hidden rounded-[24px] bg-white active:opacity-90 ${
        isFeatured
          ? 'border border-[#8d171e]/30 shadow-[0_12px_32px_rgba(141,23,30,0.12)]'
          : 'border border-[#ead8c7] shadow-[0_8px_24px_rgba(75,35,24,0.07)]'
      }`}
    >
      <ImageBackground
        source={{ uri: offer.imageUrl }}
        resizeMode="cover"
        style={{ width: '100%', height: imageHeight }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
          className="flex-1 justify-between p-4"
        >
          <View className="flex-row items-start justify-between gap-3">
            <ComboBadge />
            {savings > 0 ? (
              <View className="rounded-full bg-[#fff8ee] px-2.5 py-1">
                <Text className="text-[10px] font-extrabold text-[#8d171e]">
                  Risparmi €{savings.toFixed(2)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-xl font-black leading-6 text-white" numberOfLines={2}>
            {offer.title}
          </Text>
        </LinearGradient>
      </ImageBackground>

      <View className="gap-3 p-4">
        <Text className="text-sm leading-6 text-[#65554c]">{offer.subtitle}</Text>
        <OfferPreviewImages offer={offer} />

        <View className="flex-row items-end justify-between gap-3">
          <View className="min-w-0 flex-1 gap-2">
            <OfferPrice price={offer.price} originalPrice={offer.originalPrice} size="lg" />
            <OfferIncludes items={offer.includes} />
          </View>
          <AddButton size="lg" />
        </View>
      </View>
    </Pressable>
  );
}

function RowOfferCard({
  offer,
  width,
  height,
  isFeatured,
  onPress,
}: {
  readonly offer: ResolvedComboOffer;
  readonly width: number;
  readonly height: number;
  readonly isFeatured: boolean;
  readonly onPress: () => void;
}) {
  const imageWidth = Math.round(width * 0.4);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        offer.price > 0 ? `${offer.title}, €${offer.price.toFixed(2)}` : offer.title
      }
      accessibilityHint="Aggiunge il combo al carrello e apre il menu"
      onPress={onPress}
      style={{ width, height }}
      className={`flex-row overflow-hidden rounded-[20px] bg-white active:opacity-90 ${
        isFeatured
          ? 'border border-[#8d171e]/35 shadow-[0_10px_28px_rgba(141,23,30,0.12)]'
          : 'border border-[#ead8c7] shadow-[0_6px_18px_rgba(75,35,24,0.06)]'
      }`}
    >
      <ImageBackground
        source={{ uri: offer.imageUrl }}
        resizeMode="cover"
        style={{ width: imageWidth, height }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)']}
          className="flex-1 justify-end p-2.5"
        >
          <ComboBadge />
        </LinearGradient>
      </ImageBackground>

      <View className="flex-1 justify-between px-3.5 py-3">
        <View className="gap-1">
          <Text className="text-base font-black leading-5 text-[#271d19]" numberOfLines={1}>
            {offer.title}
          </Text>
          <Text className="text-[11px] leading-4 text-[#75645a]" numberOfLines={2}>
            {offer.subtitle}
          </Text>
        </View>

        <OfferPreviewImages offer={offer} />

        <View className="mt-1 flex-row items-end justify-between">
          <View className="min-w-0 flex-1 pr-2">
            <OfferPrice price={offer.price} originalPrice={offer.originalPrice} />
            <View className="mt-0.5">
              <OfferIncludes items={offer.includes} />
            </View>
          </View>
          <AddButton />
        </View>
      </View>
    </Pressable>
  );
}

export function OfferCard({
  offer,
  onPress,
  layout = 'row',
  width,
  height,
  isFeatured = false,
}: OfferCardProps) {
  if (layout === 'stack') {
    return (
      <StackOfferCard offer={offer} width={width} isFeatured={isFeatured} onPress={onPress} />
    );
  }

  return (
    <RowOfferCard
      offer={offer}
      width={width ?? 360}
      height={height ?? 168}
      isFeatured={isFeatured}
      onPress={onPress}
    />
  );
}
