import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

export default function AdminOptionsScreen() {
  const { isAdmin, isKioskMode, enterKioskMode, exitKioskMode } = useAuth();
  const router = useRouter();

  if (!isAdmin) {
    // Se qualcuno arriva qui senza permessi admin, rimandiamo al menu principale
    router.replace('/(tabs)/menu');
    return null;
  }

  const handleToggleKiosk = () => {
    if (isKioskMode) {
      exitKioskMode();
      Alert.alert('Modalità Kiosk disattivata', 'L\'app è tornata alla modalità normale.');
    } else {
      enterKioskMode();
      Alert.alert(
        'Modalità Kiosk attivata',
        'Questo dispositivo ora è configurato come kiosk. Per tornare alla modalità normale, disattiva la modalità dalle opzioni.'
      );
    }
  };

  return (
    <View className="flex-1 bg-background p-8">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-8">
        <Pressable
          onPress={() => router.back()}
          className="bg-secondary rounded-full p-3 w-10 h-10 items-center justify-center active:opacity-80"
        >
          <FontAwesome name="arrow-left" size={18} color="black" />
        </Pressable>
        <Text className="text-foreground font-extrabold text-2xl">Opzioni Admin</Text>
        <View className="w-10" />
      </View>

      {/* Kiosk Mode Card */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Modalità Kiosk
        </Text>
        <Text className="text-muted-foreground mb-4">
          Attiva questa opzione solo da un account admin per trasformare il dispositivo in un kiosk
          (ordine da totem senza login).
        </Text>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">
            Stato attuale:{' '}
            <Text className="font-semibold text-foreground">
              {isKioskMode ? 'ATTIVA' : 'DISATTIVA'}
            </Text>
          </Text>
          <Button
            title={isKioskMode ? 'Disattiva Kiosk' : 'Attiva Kiosk'}
            onPress={handleToggleKiosk}
            size="lg"
          />
        </View>
      </View>

      <View className="mt-2">
        <Text className="text-xs text-muted-foreground">
          Nota: la scelta viene ricordata sul dispositivo. Anche dopo aver chiuso l\'app, se la
          modalità kiosk è attiva il dispositivo continuerà ad avviarsi in quella modalità.
        </Text>
      </View>
    </View>
  );
}

