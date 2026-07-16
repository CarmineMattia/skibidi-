import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import { FontAwesome } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

interface LandingHeaderProps {
  readonly isAuthenticated: boolean;
  readonly isDesktop: boolean;
  readonly topInset: number;
  readonly onMenu: () => void;
  readonly onOffers: () => void;
  readonly onGallery: () => void;
  readonly onContact: () => void;
  readonly onAccount: () => void;
}

function HeaderLink({
  label,
  onPress,
  compact = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly compact?: boolean;
}) {
  if (compact) {
    return (
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        className="rounded-xl border border-[#8d171e]/12 bg-white/80 px-4 py-2 active:opacity-70 web:hover:bg-white web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
      >
        <Text className="text-xs font-bold text-[#453831]">{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className="rounded-lg px-3 py-2 active:opacity-60 web:hover:bg-[#8d171e]/[0.07] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
    >
      <Text className="text-sm font-bold text-[#342b27]">{label}</Text>
    </Pressable>
  );
}

export function LandingHeader({
  isAuthenticated,
  isDesktop,
  topInset,
  onMenu,
  onOffers,
  onGallery,
  onContact,
  onAccount,
}: LandingHeaderProps) {
  return (
    <View
      className="z-20 border-b border-[#8d171e]/10 bg-[#fff9f1]/95"
      style={{ paddingTop: topInset }}
    >
      <View
        className="w-full max-w-[1240px] self-center flex-row items-center justify-between px-4 md:px-6"
        style={{ minHeight: isDesktop ? 78 : 62 }}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5 md:flex-none md:gap-3">
          <View
            className="shrink-0"
            style={{ height: isDesktop ? 48 : 36, width: isDesktop ? 86 : 64 }}
          >
            <Image
              source={BRAND_LOGO}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
              accessibilityLabel={`Logo ${BRAND.name}`}
            />
          </View>
          <View className="min-w-0 flex-1 md:flex-none">
            <Text
              className={`font-black tracking-[-0.3px] text-[#271d19] ${isDesktop ? 'text-base' : 'text-sm'}`}
              numberOfLines={1}
            >
              {BRAND.name}
            </Text>
            <Text
              className={`font-semibold text-[#8d171e] ${isDesktop ? 'text-xs' : 'text-[11px]'}`}
              numberOfLines={1}
            >
              {BRAND.tagline}
            </Text>
          </View>
        </View>

        {isDesktop ? (
          <View className="flex-row items-center gap-1">
            <HeaderLink label="Menu" onPress={onMenu} />
            <HeaderLink label="Offerte" onPress={onOffers} />
            <HeaderLink label="Gallery" onPress={onGallery} />
            <HeaderLink label="Contatti" onPress={onContact} />
          </View>
        ) : null}

        <View className="flex-row items-center gap-2">
          {isDesktop ? (
            <Pressable
              accessibilityRole="link"
              onPress={onAccount}
              className="h-11 flex-row items-center gap-2 rounded-xl px-3 active:opacity-60 web:hover:bg-[#8d171e]/[0.07] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
            >
              <FontAwesome name="user-o" size={15} color="#8d171e" />
              <Text className="text-sm font-bold text-[#8d171e]">
                {isAuthenticated ? 'Il mio profilo' : 'Accedi'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="link"
              onPress={onAccount}
              className="h-10 w-10 items-center justify-center rounded-full border border-[#8d171e]/15 bg-white active:opacity-60 web:hover:bg-[#8d171e]/[0.06] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
            >
              <FontAwesome name="user-o" size={15} color="#8d171e" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onMenu}
            className="h-11 flex-row items-center gap-2 rounded-xl bg-[#8d171e] px-4 active:scale-[0.98] active:opacity-90 web:hover:bg-[#741218] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#e1a255]"
          >
            <FontAwesome name="cutlery" size={14} color="#ffffff" />
            <Text className="text-sm font-extrabold text-white">Ordina</Text>
          </Pressable>
        </View>
      </View>

      {!isDesktop ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-t border-[#8d171e]/8"
          contentContainerClassName="gap-2 px-4 py-2.5"
        >
          <HeaderLink compact label="Menu" onPress={onMenu} />
          <HeaderLink compact label="Offerte" onPress={onOffers} />
          <HeaderLink compact label="Gallery" onPress={onGallery} />
          <HeaderLink compact label="Contatti" onPress={onContact} />
        </ScrollView>
      ) : null}
    </View>
  );
}
