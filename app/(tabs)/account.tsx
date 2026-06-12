import { useAuth } from '@/lib/stores/AuthContext';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, userRole, isGuest, isAuthenticated, isAdmin, signOut, exitGuestMode } = useAuth();

  const handleLogout = async () => {
    try {
      if (isGuest && !isAuthenticated) {
        exitGuestMode();
      } else {
        await signOut();
      }
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Errore', 'Impossibile effettuare il logout.');
    }
  };

  const displayRole = (() => {
    const rawRole = (profile?.role || userRole || (isGuest ? 'customer' : 'kiosk')).toLowerCase();
    if (rawRole === 'customer') return 'Cliente';
    if (rawRole === 'admin') return 'Admin';
    if (rawRole === 'kiosk') return 'Kiosk';
    return rawRole;
  })();

  return (
    <ScrollView className="flex-1 bg-[#f9ecdd] p-5" contentContainerStyle={{ paddingTop: insets.top + 8 }}>
      <View className="bg-white rounded-2xl p-5 border border-[#e1a255]/40 mb-4 gap-1">
        <Text className="text-xs font-bold uppercase tracking-wider text-[#8d171e]">Account Ambrosia</Text>
        <Text className="text-2xl font-black text-gray-900">Profilo</Text>
        <Text className="text-gray-600">
          {isGuest ? 'Stai navigando come utente ospite.' : 'Il tuo account e attivo e pronto.'}
        </Text>
      </View>

      {!isAuthenticated && (
        <View className="bg-[#f9ecdd] rounded-2xl p-4 border border-[#e1a255]/60 mb-4 gap-3">
          <Text className="text-orange-900 font-extrabold">Accedi per salvare ordini e preferiti</Text>
          <Pressable
            onPress={() => router.push('/login')}
            className="bg-[#8d171e] rounded-xl px-4 py-3 active:opacity-80"
          >
            <Text className="text-white text-center font-bold text-base">Vai al login</Text>
          </Pressable>
        </View>
      )}

      <View className="bg-white rounded-2xl p-5 border border-[#e1a255]/40 mb-6 gap-2">
        <Text className="text-sm text-gray-500">Nome</Text>
        <Text className="text-lg font-semibold text-gray-900">
          {profile?.full_name || (isGuest ? 'Ospite' : 'Utente')}
        </Text>

        <Text className="text-sm text-gray-500 mt-3">Email</Text>
        <Text className="text-base text-gray-900">
          {profile?.email || (isGuest ? 'Non disponibile in modalita ospite' : '-')}
        </Text>

        <Text className="text-sm text-gray-500 mt-3">Ruolo</Text>
        <Text className="text-base text-gray-900">{displayRole}</Text>
      </View>

      {isAdmin && (
        <Pressable
          onPress={() => router.push('/admin-options')}
          className="bg-[#8d171e] rounded-xl px-4 py-4 active:opacity-80 mb-3"
        >
          <Text className="text-white text-center font-bold text-base">
            Opzioni Admin
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleLogout}
        className="bg-[#1f2937] rounded-xl px-4 py-4 active:opacity-80"
      >
        <Text className="text-white text-center font-bold text-base">
          Esci
        </Text>
      </Pressable>
    </ScrollView>
  );
}
