import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, Pressable, Text, View } from 'react-native';

interface HomeGuestHeroProps {
  readonly onOrderNow: () => void;
  readonly onViewMenu: () => void;
}

export function HomeGuestHero({ onOrderNow, onViewMenu }: HomeGuestHeroProps) {
  return (
    <View className="gap-2.5">
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80',
        }}
        resizeMode="cover"
        className="rounded-[30px] overflow-hidden border border-[#e3c9b8] shadow-sm"
      >
        <LinearGradient
          colors={['rgba(30,20,17,0.92)', 'rgba(30,20,17,0.68)', 'rgba(30,20,17,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-5 gap-3.5"
        >
          <View className="gap-1.5">
            <Text className="text-orange-200/90 text-[11px] font-semibold uppercase tracking-wider">
              Artisanal & authentic
            </Text>
            <Text className="text-white text-[50px] font-black leading-[52px]">THE ART OF THE WOOD-FIRE.</Text>
            <Text className="text-zinc-100 text-[13px] leading-[18px]">
              Long-fermented dough, premium ingredients, and real-time order tracking.
            </Text>
          </View>

          <View className="gap-2">
            <Pressable
              onPress={onOrderNow}
              className="bg-[#d4451a] rounded-2xl h-[54px] items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-extrabold text-[16px]">ORDER NOW →</Text>
            </Pressable>
            <Pressable
              onPress={onViewMenu}
              className="bg-white/10 border border-white/35 rounded-2xl h-[50px] items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-bold text-[16px]">VIEW MENU</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View className="bg-white rounded-2xl border border-[#ead8c7] px-4 py-3.5 gap-2 shadow-sm">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-gray-900 text-lg font-extrabold">Prosciutto Crudo di Parma</Text>
            <Text className="text-gray-600 text-xs mt-1">
              24-month aged prosciutto, wild arugula, buffalo mozzarella and white truffle oil.
            </Text>
          </View>
          <View className="bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1">
            <Text className="text-orange-700 text-xs font-extrabold">$24</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
