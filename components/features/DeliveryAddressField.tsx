import { getDeliveryZoneMessage, looksLikeOutOfDeliveryZone } from '@/lib/utils/deliveryZone';
import { getCurrentDeviceCoordinates } from '@/lib/utils/deviceLocation';
import { reverseGeocode } from '@/lib/utils/geocoding';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

type DeliveryAddressFieldProps = {
  label: string;
  placeholder: string;
  address: string;
  onAddressChange: (value: string) => void;
  civico: string;
  onCivicoChange: (value: string) => void;
  civicoLabel: string;
  civicoPlaceholder: string;
  error?: string;
  civicoError?: string;
  hasError?: boolean;
  hasCivicoError?: boolean;
  mapHint?: string;
  searchingLabel?: string;
  hint?: string;
};

export function DeliveryAddressField({
  label,
  placeholder,
  address,
  onAddressChange,
  civico,
  onCivicoChange,
  civicoLabel,
  civicoPlaceholder,
  error,
  civicoError,
  hasError,
  hasCivicoError,
  searchingLabel = 'Cerco indirizzo…',
  hint,
}: DeliveryAddressFieldProps) {
  const { language } = useAppSettings();
  const zoneMessage = getDeliveryZoneMessage(language === 'en' ? 'en' : 'it');
  const liveZoneError = looksLikeOutOfDeliveryZone(address) ? zoneMessage : null;
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const addressError = error || liveZoneError || locateError;

  const handleUseMyLocation = async () => {
    setLocateError(null);
    setIsLocating(true);
    try {
      const result = await getCurrentDeviceCoordinates();
      if (!result.ok) {
        setLocateError(result.message);
        return;
      }
      const resolved = await reverseGeocode(result.coordinates);
      onAddressChange(resolved);
    } catch {
      setLocateError('Non riesco a leggere la posizione. Digita l’indirizzo o riprova.');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View className="gap-1">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-foreground">{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usa la mia posizione"
          className="flex-row items-center gap-2 rounded-full bg-primary/10 px-4 py-2.5 active:opacity-80"
          onPress={() => {
            void handleUseMyLocation();
          }}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#8d171e" />
          ) : (
            <FontAwesome name="location-arrow" size={14} color="#8d171e" />
          )}
          <Text className="text-sm font-bold text-primary">
            {isLocating ? searchingLabel : 'Usa posizione'}
          </Text>
        </Pressable>
      </View>

      <TextInput
        className={`min-h-[88px] rounded-2xl border bg-background px-4 py-4 text-base leading-6 ${
          hasError || liveZoneError || locateError ? 'border-red-500 bg-red-50' : 'border-border'
        }`}
        placeholder={placeholder}
        multiline
        value={address}
        onChangeText={(value) => {
          setLocateError(null);
          onAddressChange(value);
        }}
      />
      {addressError ? (
        <Text className="mt-2 text-sm font-semibold text-red-600">{addressError}</Text>
      ) : null}
      {hint && !addressError ? (
        <Text className="mt-2 text-sm leading-5 text-muted-foreground">{hint}</Text>
      ) : null}

      <Text className="mb-2 mt-5 text-base font-semibold text-foreground">{civicoLabel}</Text>
      <TextInput
        className={`rounded-2xl border bg-background px-4 py-4 text-base ${
          hasCivicoError ? 'border-red-500 bg-red-50' : 'border-border'
        }`}
        placeholder={civicoPlaceholder}
        value={civico}
        onChangeText={onCivicoChange}
        keyboardType="default"
        autoCapitalize="characters"
      />
      {civicoError ? <Text className="mt-1 text-xs text-red-500">{civicoError}</Text> : null}
    </View>
  );
}
