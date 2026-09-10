import { getDeliveryZoneMessage, looksLikeOutOfDeliveryZone } from '@/lib/utils/deliveryZone';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { Text, TextInput, View } from 'react-native';

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
  hint,
}: DeliveryAddressFieldProps) {
  const { language } = useAppSettings();
  const zoneMessage = getDeliveryZoneMessage(language === 'en' ? 'en' : 'it');
  const liveZoneError = looksLikeOutOfDeliveryZone(address) ? zoneMessage : null;
  const addressError = error || liveZoneError;

  return (
    <View>
      <Text className="text-sm font-medium mb-2">{label}</Text>
      <TextInput
        className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[80px] ${
          hasError || liveZoneError ? 'border-red-500 bg-red-50' : 'border-border'
        }`}
        placeholder={placeholder}
        multiline
        value={address}
        onChangeText={onAddressChange}
      />
      {addressError ? <Text className="text-red-600 text-sm font-semibold mt-1">{addressError}</Text> : null}
      {hint && !addressError ? (
        <Text className="text-xs text-muted-foreground mt-2">{hint}</Text>
      ) : null}

      <Text className="text-sm font-medium mb-2 mt-3">{civicoLabel}</Text>
      <TextInput
        className={`bg-background border rounded-xl px-4 py-3 text-base ${
          hasCivicoError ? 'border-red-500 bg-red-50' : 'border-border'
        }`}
        placeholder={civicoPlaceholder}
        value={civico}
        onChangeText={onCivicoChange}
        keyboardType="default"
        autoCapitalize="characters"
      />
      {civicoError ? <Text className="text-red-500 text-xs mt-1">{civicoError}</Text> : null}
    </View>
  );
}
