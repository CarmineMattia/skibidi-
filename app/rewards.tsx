import { SkibidiCoinCard } from '@/components/features/loyalty/SkibidiCoinCard';
import { useAuth } from '@/lib/stores/AuthContext';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#f9ecdd]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      >
        <View className="px-4 gap-4">
          <View className="rounded-2xl border border-[#e1a255]/60 bg-[#8d171e] p-5">
            <Text className="text-[#f3dabb] text-xs font-bold uppercase tracking-wider">
              Pizzeria Ambrosia
            </Text>
            <Text className="text-white text-2xl font-black mt-1">Skibidi Coin</Text>
            <Text className="text-[#f3dabb] mt-1">
              1 punto per ogni euro di pizza. 100 punti, 5 euro di sconto in cassa.
            </Text>
          </View>

          {isAuthenticated ? (
            <SkibidiCoinCard />
          ) : (
            <View className="bg-white rounded-2xl border border-[#e1a255]/40 p-4 gap-3">
              <Text className="text-gray-900 font-extrabold">Accedi per vedere i tuoi punti</Text>
              <Text className="text-sm text-gray-600">
                I punti restano sul tuo account e si usano solo in questa pizzeria. Non si comprano e non si regalano ad altri clienti.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/login')}
                className="h-12 rounded-xl bg-[#8d171e] items-center justify-center"
              >
                <Text className="text-white font-bold">Accedi</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/menu')}
            className="h-12 rounded-xl bg-[#1f2937] items-center justify-center active:opacity-90"
          >
            <Text className="text-white font-bold">Vai al menu</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
