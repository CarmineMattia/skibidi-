import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

interface HomeLoggedWelcomeProps {
  readonly firstName: string;
  readonly onReorderLast: () => void;
  readonly onContinueMenu: () => void;
}

export function HomeLoggedWelcome({
  firstName,
  onReorderLast,
  onContinueMenu,
}: HomeLoggedWelcomeProps) {
  return (
    <LinearGradient
      colors={['#fdf9f3', '#f7efe3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-2xl border border-orange-100 p-4 shadow-sm"
    >
      <View className="gap-3">
        <Text className="text-base font-semibold text-orange-700">Bentornato, {firstName} 👋</Text>
        <Text className="text-2xl font-extrabold text-gray-900">Pronto per la tua prossima pizza?</Text>
        <Text className="text-gray-600 text-sm">
          Riordina in un tap o continua con il menu artigianale del giorno.
        </Text>

        <View className="gap-2">
          <Pressable
            onPress={onReorderLast}
            className="bg-[#d4451a] rounded-xl h-12 items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-extrabold text-base">🔁 Riordina Ultimo Ordine</Text>
          </Pressable>
          <Pressable
            onPress={onContinueMenu}
            className="bg-white border border-orange-200 rounded-xl h-12 items-center justify-center active:opacity-90"
          >
            <Text className="text-orange-700 font-bold text-base">🛍️ Continua dal Menu</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}
