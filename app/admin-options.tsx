import { Button } from '@/components/ui/Button';
import { useAppSettings, type AppLanguage } from '@/lib/stores/AppSettingsContext';
import { useAuth } from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

export default function AdminOptionsScreen() {
  const { isAdmin, isKioskMode, enterKioskMode, exitKioskMode } = useAuth();
  const { language, deliveryFee, setLanguage, setDeliveryFee } = useAppSettings();
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

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    Alert.alert(
      nextLanguage === 'it' ? 'Lingua aggiornata' : 'Language updated',
      nextLanguage === 'it'
        ? 'L interfaccia checkout usera l italiano.'
        : 'Checkout interface will use English.'
    );
  };

  const handleDeliveryFeeChange = (raw: string) => {
    const normalized = raw.replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setDeliveryFee(parsed);
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

      {/* Language */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Lingua / Language
        </Text>
        <Text className="text-muted-foreground mb-4">
          Scegli la lingua del checkout cliente.
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${language === 'it' ? 'bg-primary' : 'bg-secondary'}`}
            onPress={() => handleLanguageChange('it')}
          >
            <Text className={`${language === 'it' ? 'text-primary-foreground' : 'text-foreground'} font-bold`}>
              Italiano
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl py-3 items-center ${language === 'en' ? 'bg-primary' : 'bg-secondary'}`}
            onPress={() => handleLanguageChange('en')}
          >
            <Text className={`${language === 'en' ? 'text-primary-foreground' : 'text-foreground'} font-bold`}>
              English
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Delivery fee */}
      <View className="bg-card rounded-2xl p-6 border border-border shadow-lg">
        <Text className="text-card-foreground font-semibold text-xl mb-2">
          Costo delivery
        </Text>
        <Text className="text-muted-foreground mb-4">
          Imposta il supplemento delivery in euro (es. 2.00).
        </Text>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 rounded-xl bg-secondary items-center justify-center">
            <Text className="text-foreground font-bold text-lg">€</Text>
          </View>
          <TextInput
            className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold"
            keyboardType="decimal-pad"
            value={deliveryFee.toFixed(2)}
            onChangeText={handleDeliveryFeeChange}
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

