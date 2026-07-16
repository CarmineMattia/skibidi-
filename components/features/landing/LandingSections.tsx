import { BRAND } from '@/lib/data/brand';
import { FontAwesome } from '@expo/vector-icons';
import { Image, ImageBackground, Linking, Pressable, Text, View } from 'react-native';

const PREPARATION_IMAGE = require('@/assets/images/landing/preparazione.jpeg') as number;
const MARGHERITA_IMAGE = require('@/assets/images/landing/margherita.jpeg') as number;
const DOUGH_IMAGE = require('@/assets/images/landing/impasto.jpeg') as number;
const DELIVERY_IMAGE = require('@/assets/images/landing/consegna.jpeg') as number;

interface ResponsiveSectionProps {
  readonly isDesktop: boolean;
  readonly isCompact: boolean;
}

interface LandingServicesProps extends ResponsiveSectionProps {
  readonly onMenu: () => void;
}

function SectionEyebrow({ children }: { readonly children: string }) {
  return (
    <View className="mb-4 flex-row items-center gap-3">
      <View className="h-px w-8 bg-[#8d171e]" />
      <Text className="text-xs font-black uppercase tracking-[2px] text-[#8d171e]">{children}</Text>
    </View>
  );
}

export function LandingServices({ isDesktop, isCompact, onMenu }: LandingServicesProps) {
  return (
    <View className={`w-full max-w-[1240px] self-center ${isCompact ? 'px-5 py-16' : 'px-8 py-24'}`}>
      <View className={`${isDesktop ? 'flex-row items-end justify-between' : ''}`}>
        <View style={{ maxWidth: 690 }}>
          <SectionEyebrow>La nostra pizzeria</SectionEyebrow>
          <Text
            className={`font-black tracking-[-1.5px] text-[#271d19] ${
              isCompact ? 'text-[36px] leading-[40px]' : 'text-[50px] leading-[54px]'
            }`}
          >
            Tradizione nel forno,{'\n'}libertà nel piatto.
          </Text>
        </View>
        <Text
          className={`text-base leading-7 text-[#65554c] ${isDesktop ? 'max-w-[410px] pb-1' : 'mt-5'}`}
        >
          {BRAND.story}
        </Text>
      </View>

      <View className={`mt-12 gap-5 ${isDesktop ? 'flex-row' : ''}`}>
        <View
          className="overflow-hidden rounded-[28px] bg-[#8d171e]"
          style={{ flex: isDesktop ? 1.15 : undefined, minHeight: isCompact ? 390 : 430 }}
        >
          <ImageBackground
            source={PREPARATION_IMAGE}
            resizeMode="cover"
            accessibilityLabel="Preparazione artigianale di una pizza Ambrosia"
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View className="absolute inset-0 bg-black/35" />
            <View className="p-6">
              <View className="mb-3 h-11 w-11 items-center justify-center rounded-xl bg-[#fff8ee]">
                <FontAwesome name="fire" size={20} color="#8d171e" />
              </View>
              <Text className="text-3xl font-black tracking-[-0.8px] text-white">Fatta come la vuoi tu</Text>
              <Text className="mt-2 max-w-[480px] text-base leading-6 text-[#fff4e5]">
                Bianche, gustose, al metro o create con i tuoi ingredienti preferiti.
              </Text>
            </View>
          </ImageBackground>
        </View>

        <View
          className="justify-between overflow-hidden rounded-[28px] bg-[#efcf9e] p-6"
          style={{ flex: isDesktop ? 0.85 : undefined, minHeight: isCompact ? 350 : 430 }}
        >
          <View>
            <View className="mb-5 h-12 w-12 items-center justify-center rounded-xl bg-[#8d171e]">
              <FontAwesome name="motorcycle" size={21} color="#ffffff" />
            </View>
            <Text className="text-4xl font-black tracking-[-1px] text-[#271d19]">A casa tua.</Text>
            <Text className="mt-3 max-w-[390px] text-base leading-7 text-[#59483f]">
              Con soli {BRAND.deliveryFee} portiamo le pizze da te. Oppure passa a ritirarle appena
              sfornate.
            </Text>
          </View>
          <View>
            <View className="mb-5 h-px bg-[#8d171e]/20" />
            <Pressable
              accessibilityRole="button"
              onPress={onMenu}
              className="min-h-14 flex-row items-center justify-between rounded-xl bg-[#271d19] px-5 active:scale-[0.98] web:hover:bg-[#3b2c26] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
            >
              <Text className="text-base font-extrabold text-white">Scegli la tua pizza</Text>
              <FontAwesome name="arrow-right" size={15} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export function LandingGallery({ isDesktop, isCompact }: ResponsiveSectionProps) {
  const sideImageHeight = isDesktop ? 292 : isCompact ? 210 : 250;

  return (
    <View className="bg-[#241a16]">
      <View className={`w-full max-w-[1240px] self-center ${isCompact ? 'px-5 py-16' : 'px-8 py-24'}`}>
        <SectionEyebrow>Dentro Ambrosia</SectionEyebrow>
        <View className={`${isDesktop ? 'flex-row items-end justify-between' : ''}`}>
          <Text
            className={`font-black tracking-[-1.4px] text-[#fff8ee] ${
              isCompact ? 'text-[36px] leading-[40px]' : 'text-[50px] leading-[54px]'
            }`}
          >
            Un ambiente{'\n'}da condividere.
          </Text>
          <Text className={`text-base leading-7 text-[#d9c7b8] ${isDesktop ? 'max-w-[400px]' : 'mt-5'}`}>
            Dal primo impasto all’ultima fetta: qui la pizza è un momento da vivere insieme.
          </Text>
        </View>

        <View className={`mt-10 gap-4 ${isDesktop ? 'flex-row' : ''}`}>
          <Image
            source={MARGHERITA_IMAGE}
            resizeMode="cover"
            accessibilityLabel="Pizza margherita appena sfornata"
            className="rounded-[24px]"
            style={{ flex: isDesktop ? 1.15 : undefined, width: '100%', height: isDesktop ? 600 : 330 }}
          />
          <View className="gap-4" style={{ flex: isDesktop ? 0.85 : undefined }}>
            <Image
              source={DOUGH_IMAGE}
              resizeMode="cover"
              accessibilityLabel="Pallina di impasto fresco"
              className="rounded-[24px]"
              style={{ width: '100%', height: sideImageHeight }}
            />
            <Image
              source={DELIVERY_IMAGE}
              resizeMode="cover"
              accessibilityLabel="Pizze Ambrosia pronte per la consegna"
              className="rounded-[24px]"
              style={{ width: '100%', height: sideImageHeight }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function LandingContact({ isDesktop, isCompact }: ResponsiveSectionProps) {
  const openPhone = () => void Linking.openURL(BRAND.phoneHref);
  const openMaps = () => void Linking.openURL(BRAND.mapsUrl);

  return (
    <View className="bg-[#fff8ee]">
      <View className={`w-full max-w-[1240px] self-center ${isCompact ? 'px-5 py-16' : 'px-8 py-24'}`}>
        <SectionEyebrow>Vieni a trovarci</SectionEyebrow>
        <View className={`gap-10 ${isDesktop ? 'flex-row' : ''}`}>
          <View style={{ flex: 0.9 }}>
            <Text
              className={`font-black tracking-[-1.3px] text-[#271d19] ${
                isCompact ? 'text-[36px] leading-[40px]' : 'text-[50px] leading-[54px]'
              }`}
            >
              La tua prossima pizza è qui.
            </Text>
            <Text className="mt-5 text-base leading-7 text-[#65554c]">{BRAND.address}</Text>

            <View className={`mt-8 gap-3 ${isCompact ? '' : 'flex-row'}`}>
              <Pressable
                accessibilityRole="link"
                onPress={openPhone}
                className="min-h-14 flex-row items-center justify-center gap-3 rounded-xl bg-[#8d171e] px-5 active:opacity-80 web:hover:bg-[#741218] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#e1a255]"
              >
                <FontAwesome name="phone" size={16} color="#ffffff" />
                <Text className="text-base font-extrabold text-white">{BRAND.phone}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={openMaps}
                className="min-h-14 flex-row items-center justify-center gap-3 rounded-xl border border-[#8d171e]/25 px-5 active:opacity-70 web:hover:bg-[#8d171e]/[0.06] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#8d171e]"
              >
                <FontAwesome name="map-o" size={16} color="#8d171e" />
                <Text className="text-base font-extrabold text-[#8d171e]">Apri la mappa</Text>
              </Pressable>
            </View>
          </View>

          <View
            className="overflow-hidden rounded-[28px] bg-[#f0daca] p-6"
            style={{ flex: 1.1 }}
          >
            <View className="mb-4 flex-row items-center gap-3">
              <FontAwesome name="clock-o" size={18} color="#8d171e" />
              <Text className="text-xl font-black text-[#271d19]">Orari di apertura</Text>
            </View>
            {BRAND.hours.map((item, index) => (
              <View
                key={item.day}
                className={`flex-row items-center justify-between py-3 ${
                  index < BRAND.hours.length - 1 ? 'border-b border-[#8d171e]/10' : ''
                }`}
              >
                <Text className="font-bold text-[#453831]">{item.day}</Text>
                <Text className={`font-semibold ${item.hours === 'Chiuso' ? 'text-[#8d171e]' : 'text-[#65554c]'}`}>
                  {item.hours}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="border-t border-[#8d171e]/10 px-5 py-8">
        <View className={`w-full max-w-[1240px] self-center gap-3 ${isDesktop ? 'flex-row items-center justify-between' : ''}`}>
          <View>
            <Text className="font-black text-[#271d19]">{BRAND.name}</Text>
            <Text className="mt-1 text-xs text-[#75645a]">{BRAND.tagline}</Text>
          </View>
          <Text className="text-xs leading-5 text-[#75645a]">
            © {new Date().getFullYear()} {BRAND.name}. Tutti i diritti riservati.
          </Text>
        </View>
      </View>
    </View>
  );
}
