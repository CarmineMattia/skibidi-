import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

interface HomeLoggedWelcomeProps {
  readonly firstName: string;
  readonly showReorder: boolean;
  readonly onReorderLast?: () => void;
  readonly onContinueMenu: () => void;
  readonly showActions?: boolean;
}

export function HomeLoggedWelcome({
  firstName,
  showReorder,
  onReorderLast,
  onContinueMenu,
  showActions = true,
}: HomeLoggedWelcomeProps) {
  return (
    <LinearGradient
      colors={['#f9ecdd', '#f0daca']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-2xl border border-[#e1a255]/40 p-4 shadow-sm"
    >
      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <FontAwesome name="user-circle" size={14} color="#8d171e" />
          <Text className="text-base font-semibold text-[#8d171e]">Bentornato, {firstName}</Text>
        </View>
        <Text className="text-2xl font-extrabold text-gray-900">Pronto per la tua prossima pizza?</Text>
        <Text className="text-gray-600 text-sm">
          {showReorder
            ? 'Riordina in un tap o continua con il menu artigianale del giorno.'
            : 'Scopri le novita del menu artigianale e crea il tuo primo ordine.'}
        </Text>

        {showActions ? (
          <View className="gap-2">
            {showReorder && onReorderLast ? (
              <Pressable
                onPress={onReorderLast}
                className="bg-[#8d171e] rounded-xl h-12 items-center justify-center active:opacity-90"
              >
                <View className="flex-row items-center gap-2">
                  <FontAwesome name="repeat" size={14} color="#ffffff" />
                  <Text className="text-white font-extrabold text-base">Riordina ultimo ordine</Text>
                </View>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onContinueMenu}
              className={`bg-white border border-[#e1a255]/60 rounded-xl items-center justify-center active:opacity-90 ${
                showReorder ? 'h-12' : 'h-14'
              }`}
            >
              <View className="flex-row items-center gap-2">
                <FontAwesome name="cutlery" size={14} color="#8d171e" />
                <Text className="text-[#8d171e] font-bold text-base">Vedi menu</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}
