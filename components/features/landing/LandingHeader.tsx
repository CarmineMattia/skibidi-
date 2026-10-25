import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import { FontAwesome } from '@expo/vector-icons';
import { externalLinkProps } from '@/components/features/landing/linkProps';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

const MENU_TARGET: NavTarget = { route: '/(tabs)/menu' };
const OFFERS_TARGET: NavTarget = { route: '/offers' };
const CALL_TARGET: NavTarget = { url: BRAND.phoneHref };

interface LandingHeaderProps {
  readonly isAuthenticated: boolean;
  readonly isDesktop: boolean;
  readonly topInset: number;
  /** schermi stretti (< 360px): bottoni con icona sopra l'etichetta */
  readonly isNarrow?: boolean;
  readonly onMenu: () => void;
  readonly onAccount: () => void;
}

type NavIcon = 'cutlery' | 'tag' | 'phone';

/**
 * Destinazione di un bottone della barra. Le rotte interne usano <Link> di
 * expo-router (vero <a href> su web: Invio, clic centrale e "apri in nuova
 * scheda" funzionano); tel: usa externalLinkProps.
 */
type NavTarget = { readonly route: Href } | { readonly url: string };

function NavPressable({
  target,
  children,
  ...rest
}: PressableProps & { readonly target: NavTarget; readonly children: ReactNode }) {
  if ('route' in target) {
    return (
      <Link href={target.route} asChild>
        <Pressable {...rest}>{children}</Pressable>
      </Link>
    );
  }
  return (
    <Pressable {...rest} {...externalLinkProps(target.url)}>
      {children}
    </Pressable>
  );
}

/** Desktop: link testuale con icona, compatto. */
function DesktopNavLink({
  label,
  icon,
  target,
  accessibilityLabel,
}: {
  readonly label: string;
  readonly icon: NavIcon;
  readonly target: NavTarget;
  readonly accessibilityLabel?: string;
}) {
  return (
    <NavPressable
      target={target}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      className="h-11 flex-row items-center gap-2 rounded-xl px-3.5 active:opacity-60 web:hover:bg-[#8d171e]/[0.07] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
    >
      <FontAwesome name={icon} size={14} color="#8d171e" />
      <Text className="text-sm font-bold text-[#342b27]">{label}</Text>
    </NavPressable>
  );
}

/** Mobile: tre bottoni grandi a larghezza uguale (niente scroll orizzontale). */
function MobileNavButton({
  label,
  icon,
  target,
  accessibilityLabel,
  tone = 'light',
  isNarrow = false,
}: {
  readonly label: string;
  readonly icon: NavIcon;
  readonly target: NavTarget;
  readonly accessibilityLabel?: string;
  readonly tone?: 'light' | 'call';
  readonly isNarrow?: boolean;
}) {
  const isCall = tone === 'call';
  return (
    <NavPressable
      target={target}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      className={`min-h-[52px] min-w-0 flex-1 items-center justify-center rounded-2xl ${
        isNarrow ? 'gap-0.5 py-1' : 'flex-row gap-2'
      } border px-2 active:scale-[0.98] active:opacity-80 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e] ${
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
      <FontAwesome name={icon} size={isNarrow ? 14 : 16} color="#8d171e" />
      <Text
        className={`font-extrabold text-[#342b27] ${isNarrow ? 'text-[13px] leading-4' : 'text-base'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </NavPressable>
  );
}

export function LandingHeader({
  isAuthenticated,
  isDesktop,
  topInset,
  isNarrow = false,
  onMenu,
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
            <DesktopNavLink label="Menu" icon="cutlery" target={MENU_TARGET} />
            <DesktopNavLink label="Offerte" icon="tag" target={OFFERS_TARGET} />
            <DesktopNavLink
              label={`Chiama ${BRAND.phone}`}
              accessibilityLabel={`Chiama ${BRAND.phone}`}
              icon="phone"
              target={CALL_TARGET}
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
          <MobileNavButton label="Menu" icon="cutlery" target={MENU_TARGET} isNarrow={isNarrow} />
          <MobileNavButton label="Offerte" icon="tag" target={OFFERS_TARGET} isNarrow={isNarrow} />
          <MobileNavButton
            label="Chiama"
            accessibilityLabel={`Chiama ${BRAND.phone}`}
            icon="phone"
            tone="call"
            target={CALL_TARGET}
            isNarrow={isNarrow}
          />
        </View>
      ) : null}
    </View>
  );
}
