import { HomePizzaStrip } from '@/components/features/home/HomePizzaStrip';
import { BRAND } from '@/lib/data/brand';
import { FontAwesome, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Linking, Pressable, Text, View, type ViewStyle } from 'react-native';

const HERO_IMAGE = require('@/assets/images/landing/ambrosia-insegna.jpg') as number;

interface LandingHeroProps {
  readonly isDesktop: boolean;
  readonly onMenu: () => void;
  /** reserved for scroll-to-contact elsewhere; phone CTA dials directly */
  readonly onContact: () => void;
}

function openPhone() {
  void Linking.openURL(BRAND.phoneHref);
}

/** vCard → sul telefono apre “Aggiungi contatto” con nome già pronto */
function buildAmbrosiaVCard(): string {
  const tel = (BRAND.phoneE164 || BRAND.phoneHref.replace('tel:', '')).replace(/\s/g, '');
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${BRAND.name}`,
    `ORG:${BRAND.name}`,
    `TEL;TYPE=VOICE,WORK:${tel}`,
    `URL:${BRAND.website}`,
    `NOTE:${BRAND.tagline} — ${BRAND.address}`,
    'END:VCARD',
  ].join('\r\n');
}

function downloadVCardOnWeb(vcard: string) {
  if (typeof document === 'undefined') return false;
  try {
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Pizzeria-Ambrosia.vcf';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

/** Apre la chat WhatsApp con il messaggio precompilato (stesso numero di BRAND.whatsapp). */
function openWhatsAppChat() {
  const wa = BRAND.whatsapp;
  if (!wa) return;
  const text = encodeURIComponent(`Ciao ${BRAND.name}, vorrei ordinare 🍕`);
  void Linking.openURL(`https://wa.me/${wa}?text=${text}`);
}

/** Salva contatto (vCard) + apre chat WhatsApp se il numero è configurato */
function openWhatsAppOrSaveContact() {
  const vcard = buildAmbrosiaVCard();
  downloadVCardOnWeb(vcard);
  openWhatsAppChat();
}

// Layout is driven by CSS breakpoints (sm/md), not JS width props: media
// queries are already correct in the statically-rendered HTML, so the first
// paint doesn't relayout when hydration learns the real viewport width.

// Web-only glass. react-native-web forwards these CSS props, but they are not in
// ViewStyle; the cast keeps tsc green with or without generated expo-env types.
const WEB_GLASS = {
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
} as unknown as ViewStyle;

export function LandingHero({ isDesktop, onMenu }: LandingHeroProps) {
  return (
    <View className="relative min-h-[590px] overflow-hidden bg-[#211713] sm:min-h-[620px] md:min-h-[650px]">
      <Image
        source={HERO_IMAGE}
        resizeMode="cover"
        accessibilityLabel="Insegna Pizzeria Ambrosia"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: isDesktop ? '100%' : 200,
          // @ts-expect-error React Native Web forwards this CSS image property.
          objectPosition: isDesktop ? 'center' : 'center bottom',
        }}
      />
      <LinearGradient
        colors={
          isDesktop
            ? ['rgba(25, 14, 10, 0.92)', 'rgba(45, 22, 15, 0.62)', 'rgba(45, 22, 15, 0.18)']
            : ['rgba(25, 14, 10, 0.04)', 'rgba(25, 14, 10, 0.14)', 'rgba(33, 23, 19, 0.96)', '#211713']
        }
        locations={isDesktop ? undefined : [0, 0.24, 0.34, 1]}
        start={isDesktop ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
        end={isDesktop ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />

      <View className="w-full max-w-[1240px] flex-1 self-center justify-center px-5 pb-14 pt-[210px] sm:px-7 sm:pb-20 sm:pt-[270px] md:px-8 md:py-24">
        <View className="max-w-[620px] md:max-w-[710px]">
            <View className="mb-5 self-start flex-row items-center gap-2 border-l-2 border-[#e7b577] bg-black/25 px-3 py-2">
              <FontAwesome name="map-marker" size={13} color="#f3c98e" />
              <Text className="text-xs font-extrabold uppercase tracking-[1.6px] text-[#f7ddba]">
                Montecchio Emilia · Dal forno a casa
              </Text>
            </View>

            <Text className="font-black tracking-[-2px] text-[#fff8ee] text-[46px] leading-[48px] sm:text-[60px] sm:leading-[61px] md:text-[76px] md:leading-[76px]">
              Il nettare{'\n'}degli dei.
            </Text>

            <View className="mt-6 flex-row items-stretch gap-2.5 sm:max-w-[560px] sm:gap-3">
              {/* Primary: pizzas first — most colorful */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ordina le pizze"
                onPress={onMenu}
                className="min-h-[72px] min-w-0 flex-1 flex-row items-center justify-center gap-2.5 rounded-2xl px-3 active:scale-[0.98] active:opacity-95 sm:gap-3 sm:px-6 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#f0c486]"
                style={{
                  backgroundColor: '#8d171e',
                  borderWidth: 2,
                  borderColor: '#e1a255',
                  shadowColor: '#8d171e',
                  shadowOpacity: 0.45,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <View
                  className="items-center justify-center rounded-xl"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: 'rgba(243, 201, 142, 0.22)',
                    borderWidth: 1,
                    borderColor: 'rgba(243, 201, 142, 0.55)',
                  }}
                >
                  <MaterialIcons name="local-pizza" size={26} color="#f3c98e" />
                </View>
                <Text className="text-lg font-black tracking-wide text-white sm:text-xl" numberOfLines={1}>
                  Ordina le pizze
                </Text>
                <View className="hidden sm:flex">
                  <FontAwesome name="chevron-right" size={16} color="#f3c98e" />
                </View>
              </Pressable>

              {/* WhatsApp: subito visibile accanto alla CTA principale */}
              {BRAND.whatsapp ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Scrivici su WhatsApp"
                  onPress={openWhatsAppChat}
                  className="min-h-[72px] w-[86px] items-center justify-center gap-1 rounded-2xl active:scale-[0.98] active:opacity-90 sm:w-auto sm:flex-row sm:gap-2.5 sm:px-5 web:hover:bg-[#1ebe5b] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#d8ffe8]"
                  style={{
                    backgroundColor: '#25D366',
                    borderWidth: 2,
                    borderColor: '#b8f5cf',
                    shadowColor: '#128C7E',
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 6,
                  }}
                >
                  <FontAwesome5 name="whatsapp" size={28} color="#ffffff" />
                  <Text className="text-xs font-black text-white sm:text-lg">WhatsApp</Text>
                </Pressable>
              ) : null}
            </View>

            <HomePizzaStrip onOpenMenu={onMenu} />

            <Text className="mt-5 max-w-[600px] font-medium text-[#f5e8d7] text-base leading-7 sm:text-lg sm:leading-8">
              {BRAND.description} Scegli la tua pizza e ordinala direttamente online.
            </Text>

            <View className="mt-6 gap-3.5 sm:max-w-[420px]">
              {/* Call */}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Chiama ${BRAND.phone}`}
                onPress={openPhone}
                className="min-h-[64px] flex-row items-center justify-center gap-3 rounded-2xl border border-white/35 px-6 active:opacity-85 web:hover:bg-white/15 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#f0c486]"
                style={{
                  backgroundColor: 'rgba(255, 248, 238, 0.14)',
                  ...WEB_GLASS,
                  shadowColor: '#000',
                  shadowOpacity: 0.22,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                }}
              >
                <FontAwesome name="phone" size={20} color="#f3c98e" />
                <View className="items-center">
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-[#f7ddba]/90">
                    Chiama
                  </Text>
                  <Text className="text-lg font-extrabold text-[#fff8ee]">{BRAND.phone}</Text>
                </View>
              </Pressable>

              {/* WhatsApp — only if configured */}
              {BRAND.whatsapp ? <Pressable
                accessibilityRole="button"
                accessibilityLabel="Salva Pizzeria Ambrosia nei contatti e apri WhatsApp"
                onPress={openWhatsAppOrSaveContact}
                className="min-h-[64px] flex-row items-center justify-center gap-3 rounded-2xl border border-[#25D366]/55 px-6 active:opacity-90 web:hover:bg-[#25D366]/20 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#25D366]"
                style={{
                  backgroundColor: 'rgba(37, 211, 102, 0.18)',
                  ...WEB_GLASS,
                  shadowColor: '#128C7E',
                  shadowOpacity: 0.28,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                }}
              >
                <FontAwesome5 name="whatsapp" size={22} color="#d8ffe8" />
                <View className="items-center">
                  <Text className="text-lg font-extrabold text-[#f4fff8]">WhatsApp</Text>
                  <Text className="text-[11px] font-semibold text-[#e8fff0]/90">
                    Salva contatto · {BRAND.name}
                  </Text>
                </View>
              </Pressable> : null}
            </View>

            <View className="mt-8 flex-row items-center gap-5">
              <View>
                <Text className="text-2xl font-black text-[#f3c98e]">{BRAND.deliveryFee}</Text>
                <Text className="text-xs font-semibold text-[#f5e8d7]">consegna a domicilio</Text>
              </View>
              <View className="h-8 w-px bg-[#f5d5aa]/30" />
              <View>
                <Text className="text-2xl font-black text-[#f3c98e]">Ogni giorno</Text>
                <Text className="text-xs font-semibold text-[#f5e8d7]">impasto fresco</Text>
              </View>
            </View>
        </View>
      </View>
    </View>
  );
}
