import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import { FontAwesome } from '@expo/vector-icons';
import { Image, Linking, Pressable, Text, View } from 'react-native';

interface LandingHeaderProps {
  readonly isAuthenticated: boolean;
  readonly isDesktop: boolean;
  readonly topInset: number;
  readonly onMenu: () => void;
  readonly onOffers: () => void;
  readonly onAccount: () => void;
}

type NavIcon = 'cutlery' | 'tag' | 'phone';

function openPhone() {
  void Linking.openURL(BRAND.phoneHref);
}

/** Desktop: link testuale con icona, compatto. */
function DesktopNavLink({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  readonly label: string;
  readonly icon: NavIcon;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className="h-11 flex-row items-center gap-2 rounded-xl px-3.5 active:opacity-60 web:hover:bg-[#8d171e]/[0.07] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
    >
      <FontAwesome name={icon} size={14} color="#8d171e" />
      <Text className="text-sm font-bold text-[#342b27]">{label}</Text>
    </Pressable>
  );
}

/** Mobile: tre bottoni grandi a larghezza uguale (niente scroll orizzontale). */
function MobileNavButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
  tone = 'light',
}: {
  readonly label: string;
  readonly icon: NavIcon;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly tone?: 'light' | 'call';
}) {
  const isCall = tone === 'call';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className={`min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-2 active:scale-[0.98] active:opacity-80 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e] ${
        isCall ? 'border-[#e1a255] bg-[#fbecd6]' : 'border-[#8d171e]/20 bg-white'
      }`}
      style={{
        shadowColor: '#5a1a12',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <FontAwesome name={icon} size={16} color="#8d171e" />
      <Text className="text-base font-extrabold text-[#342b27]" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LandingHeader({
  isAuthenticated,
  isDesktop,
  topInset,
  onMenu,
  onOffers,
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
            <DesktopNavLink label="Menu" icon="cutlery" onPress={onMenu} />
            <DesktopNavLink label="Offerte" icon="tag" onPress={onOffers} />
            <DesktopNavLink
              label={`Chiama ${BRAND.phone}`}
              accessibilityLabel={`Chiama ora ${BRAND.phone}`}
              icon="phone"
              onPress={openPhone}
            />
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
            className={`flex-row items-center gap-2 rounded-xl bg-[#8d171e] px-4 active:scale-[0.98] active:opacity-90 web:hover:bg-[#741218] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#e1a255] ${
              isDesktop ? 'h-11' : 'h-12 px-5'
            }`}
          >
            <FontAwesome name="cutlery" size={isDesktop ? 14 : 16} color="#ffffff" />
            <Text className={`font-extrabold text-white ${isDesktop ? 'text-sm' : 'text-base'}`}>Ordina</Text>
          </Pressable>
        </View>
      </View>

      {!isDesktop ? (
        <View className="flex-row gap-2 border-t border-[#8d171e]/8 px-4 py-2.5">
          <MobileNavButton label="Menu" icon="cutlery" onPress={onMenu} />
          <MobileNavButton label="Offerte" icon="tag" onPress={onOffers} />
          <MobileNavButton
            label="Chiama"
            accessibilityLabel={`Chiama ora ${BRAND.phone}`}
            icon="phone"
            tone="call"
            onPress={openPhone}
          />
        </View>
      ) : null}
    </View>
  );
}
