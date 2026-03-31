import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REWARDS = [
  { id: 'r1', title: 'Pizza omaggio', points: 1200, unlocked: true },
  { id: 'r2', title: 'Dolce premium', points: 1800, unlocked: false },
  { id: 'r3', title: 'Consegna gratuita', points: 2400, unlocked: false },
];

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentPoints = 1460;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#fdf9f3]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      >
        <View className="px-4 gap-4">
          <View className="rounded-2xl border border-orange-200 bg-[#d4451a] p-5">
            <Text className="text-orange-100 text-xs font-bold uppercase tracking-wider">
              Rewards & Loyalty
            </Text>
            <Text className="text-white text-2xl font-black mt-1">Ambrosia Club</Text>
            <Text className="text-orange-100 mt-1">Punti attuali: {currentPoints}</Text>
          </View>

          <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-3">
            <Text className="text-gray-900 font-extrabold">Progresso livello</Text>
            <View className="h-3 bg-orange-100 rounded-full overflow-hidden">
              <View className="h-3 w-3/4 bg-[#d4451a]" />
            </View>
            <Text className="text-xs text-gray-600">340 punti al prossimo premio premium.</Text>
          </View>

          <View className="bg-white rounded-2xl border border-orange-100 p-4 gap-3">
            <Text className="text-gray-900 font-extrabold">Premi disponibili</Text>
            {REWARDS.map((reward) => (
              <View
                key={reward.id}
                className="rounded-xl border border-orange-100 bg-[#fffaf5] p-3 flex-row items-center justify-between"
              >
                <View>
                  <Text className="text-gray-900 font-bold">{reward.title}</Text>
                  <Text className="text-xs text-gray-600">{reward.points} punti</Text>
                </View>
                <View
                  className={`px-2.5 py-1 rounded-full ${
                    reward.unlocked ? 'bg-emerald-100' : 'bg-orange-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      reward.unlocked ? 'text-emerald-700' : 'text-orange-700'
                    }`}
                  >
                    {reward.unlocked ? 'Sbloccato' : 'Bloccato'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)/menu')}
            className="h-12 rounded-xl bg-[#d4451a] items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-bold">Vai al menu</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
