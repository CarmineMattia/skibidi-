import { BRAND } from '@/lib/data/brand';
import { FontAwesome, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, Linking, Pressable, Text, View } from 'react-native';

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

/** Salva contatto (vCard) + apre chat WhatsApp se il numero è configurato */
function openWhatsAppOrSaveContact() {
  const vcard = buildAmbrosiaVCard();
  downloadVCardOnWeb(vcard);

  const wa = BRAND.whatsapp;
  if (wa) {
    const text = encodeURIComponent(`Ciao ${BRAND.name}, vorrei ordinare 🍕`);
    void Linking.openURL(`https://wa.me/${wa}?text=${text}`);
  }
}

// Layout is driven by CSS breakpoints (sm/md), not JS width props: media
// queries are already correct in the statically-rendered HTML, so the first
// paint doesn't relayout when hydration learns the real viewport width.
export function LandingHero({ isDesktop, onMenu }: LandingHeroProps) {
  return (
    <View className="overflow-hidden bg-[#211713]">
      <ImageBackground
        source={HERO_IMAGE}
        resizeMode="cover"
        accessibilityLabel="Insegna Pizzeria Ambrosia"
        className="min-h-[590px] sm:min-h-[620px] md:min-h-[650px]"
      >
        <LinearGradient
          colors={
            isDesktop
              ? ['rgba(25, 14, 10, 0.92)', 'rgba(45, 22, 15, 0.62)', 'rgba(45, 22, 15, 0.18)']
              : ['rgba(25, 14, 10, 0.91)', 'rgba(45, 22, 15, 0.7)', 'rgba(45, 22, 15, 0.35)']
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', inset: 0 }}
        />

        <View className="w-full max-w-[1240px] flex-1 self-center justify-center px-5 py-14 sm:px-7 sm:py-20 md:px-8 md:py-24">
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

            <Text className="mt-6 max-w-[600px] font-medium text-[#f5e8d7] text-base leading-7 sm:text-lg sm:leading-8">
              {BRAND.description} Scegli la tua pizza e ordinala direttamente online.
            </Text>

            <View className="mt-8 gap-3.5 sm:max-w-[420px]">
              {/* Primary: Menu — most colorful */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ordina dal menu"
                onPress={onMenu}
                className="min-h-[72px] flex-row items-center justify-center gap-3 rounded-2xl px-6 active:scale-[0.98] active:opacity-95 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#f0c486]"
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
                    width: 44,
                    height: 44,
                    backgroundColor: 'rgba(243, 201, 142, 0.22)',
                    borderWidth: 1,
                    borderColor: 'rgba(243, 201, 142, 0.55)',
                  }}
                >
                  <MaterialIcons name="restaurant-menu" size={28} color="#f3c98e" />
                </View>
                <Text className="text-xl font-black tracking-wide text-white">Ordina dal menu</Text>
                <FontAwesome name="chevron-right" size={16} color="#f3c98e" />
              </Pressable>

              {/* Call */}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Chiama ${BRAND.phone}`}
                onPress={openPhone}
                className="min-h-[64px] flex-row items-center justify-center gap-3 rounded-2xl border border-white/35 px-6 active:opacity-85 web:hover:bg-white/15 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#f0c486]"
                style={{
                  backgroundColor: 'rgba(255, 248, 238, 0.14)',
                  // @ts-expect-error web-only glass
                  backdropFilter: 'blur(14px)',
                  // @ts-expect-error web-only glass
                  WebkitBackdropFilter: 'blur(14px)',
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
                  // @ts-expect-error web-only glass
                  backdropFilter: 'blur(14px)',
                  // @ts-expect-error web-only glass
                  WebkitBackdropFilter: 'blur(14px)',
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
      </ImageBackground>
    </View>
  );
}
