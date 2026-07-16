import { BRAND } from '@/lib/data/brand';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, Pressable, Text, View } from 'react-native';

const HERO_IMAGE = require('@/assets/images/landing/interior.jpeg') as number;

interface LandingHeroProps {
  readonly isDesktop: boolean;
  readonly onMenu: () => void;
  readonly onContact: () => void;
}

// Layout is driven by CSS breakpoints (sm/md), not JS width props: media
// queries are already correct in the statically-rendered HTML, so the first
// paint doesn't relayout when hydration learns the real viewport width.
export function LandingHero({ isDesktop, onMenu, onContact }: LandingHeroProps) {
  return (
    <View className="overflow-hidden bg-[#211713]">
      <ImageBackground
        source={HERO_IMAGE}
        resizeMode="cover"
        accessibilityLabel="Interno accogliente della Pizzeria Ambrosia"
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

            <View className="mt-8 gap-3 sm:flex-row sm:items-center">
              <Pressable
                accessibilityRole="button"
                onPress={onMenu}
                className="min-h-14 flex-row items-center justify-center gap-3 rounded-xl bg-[#8d171e] px-6 active:scale-[0.98] active:opacity-90 web:hover:bg-[#a51b24] web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#f0c486]"
              >
                <Text className="text-base font-extrabold text-white">Ordina dal menu</Text>
                <FontAwesome name="long-arrow-right" size={17} color="#ffffff" />
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={onContact}
                className="min-h-14 flex-row items-center justify-center gap-3 rounded-xl border border-[#f5d5aa]/50 bg-black/20 px-6 active:opacity-70 web:hover:bg-white/10 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#f0c486]"
              >
                <FontAwesome name="phone" size={16} color="#f7ddba" />
                <Text className="text-base font-extrabold text-[#fff8ee]">Orari e contatti</Text>
              </Pressable>
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
