import { useAuth } from '@/lib/stores/AuthContext';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, userRole, isGuest, isAuthenticated, signOut, exitGuestMode } = useAuth();

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

  return (
    <ScrollView className="flex-1 bg-[#fdf9f3] p-5" contentContainerStyle={{ paddingTop: insets.top + 8 }}>
      <View className="bg-white rounded-2xl p-5 border border-orange-100 mb-4 gap-1">
        <Text className="text-xs font-bold uppercase tracking-wider text-orange-700">Ambrosia Account</Text>
        <Text className="text-2xl font-black text-gray-900">Profile</Text>
        <Text className="text-gray-600">
          {isGuest ? 'You are browsing as a guest user.' : 'Your account is active and ready.'}
        </Text>
      </View>

      {!isAuthenticated && (
        <View className="bg-orange-50 rounded-2xl p-4 border border-orange-200 mb-4 gap-3">
          <Text className="text-orange-900 font-extrabold">Sign in to save orders and favorites</Text>
          <Pressable
            onPress={() => router.push('/login')}
            className="bg-[#d4451a] rounded-xl px-4 py-3 active:opacity-80"
          >
            <Text className="text-white text-center font-bold text-base">Go to Login</Text>
          </Pressable>
        </View>
      )}

      <View className="bg-white rounded-2xl p-5 border border-orange-100 mb-6 gap-2">
        <Text className="text-sm text-gray-500">Name</Text>
        <Text className="text-lg font-semibold text-gray-900">
          {profile?.full_name || (isGuest ? 'Guest' : 'User')}
        </Text>

        <Text className="text-sm text-gray-500 mt-3">Email</Text>
        <Text className="text-base text-gray-900">
          {profile?.email || (isGuest ? 'Not available in guest mode' : '-')}
        </Text>

        <Text className="text-sm text-gray-500 mt-3">Role</Text>
        <Text className="text-base text-gray-900 capitalize">
          {profile?.role || userRole || (isGuest ? 'customer' : 'kiosk')}
        </Text>
      </View>

      <Pressable
        onPress={handleLogout}
        className="bg-[#1f2937] rounded-xl px-4 py-4 active:opacity-80"
      >
        <Text className="text-white text-center font-bold text-base">
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}
