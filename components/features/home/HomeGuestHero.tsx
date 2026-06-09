import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, Pressable, Text, View } from 'react-native';

interface HomeGuestHeroProps {
  readonly onOrderNow: () => void;
  readonly onViewMenu: () => void;
  readonly showActions?: boolean;
}

export function HomeGuestHero({ onOrderNow, onViewMenu, showActions = true }: HomeGuestHeroProps) {
  return (
    <View className="gap-3">
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80',
        }}
        resizeMode="cover"
        className="rounded-[30px] overflow-hidden border border-[#e1a255] shadow-sm"
      >
        <LinearGradient
          colors={['rgba(141,23,30,0.94)', 'rgba(141,23,30,0.72)', 'rgba(30,10,12,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-6 gap-4 min-h-[250px] justify-end"
        >
          <View className="gap-1.5">
            <Text className="text-[#e7b577] text-[11px] font-semibold uppercase tracking-wider">
              Impasto a lunga lievitazione
            </Text>
            <Text className="text-white text-[38px] font-black leading-[42px]">La tua pizza preferita, in pochi minuti.</Text>
            <Text className="text-[#f3dabb] text-[13px] leading-[18px]">
              Ingredienti premium, cottura a legna e consegna tracciata in tempo reale.
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      {showActions ? (
        <View className="gap-2">
          <Pressable
            onPress={onOrderNow}
            className="bg-[#8d171e] rounded-2xl h-[56px] items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-extrabold text-[17px]">Ordina ora</Text>
          </Pressable>
          <Pressable
            onPress={onViewMenu}
            className="bg-[#f9ecdd] border border-[#e1a255] rounded-2xl h-[52px] items-center justify-center active:opacity-90"
          >
            <Text className="text-[#8d171e] font-bold text-[16px]">Vedi menu</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="bg-[#f9ecdd] rounded-2xl border border-[#e1a255] px-4 py-3.5 gap-2 shadow-sm">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[#343a40] text-lg font-extrabold">Promo del momento</Text>
            <Text className="text-[#343a40]/70 text-xs mt-1">
              Margherita DOP + bibita a prezzo speciale, solo per oggi.
            </Text>
          </View>
          <View className="bg-[#8d171e] rounded-xl px-2.5 py-1">
            <Text className="text-white text-xs font-extrabold">da €12</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
