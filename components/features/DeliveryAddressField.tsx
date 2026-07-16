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
}: DeliveryAddressFieldProps) {
  return (
    <View>
      <Text className="text-sm font-medium mb-2">{label}</Text>
      <TextInput
        className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[80px] ${
          hasError ? 'border-red-500 bg-red-50' : 'border-border'
        }`}
        placeholder={placeholder}
        multiline
        value={address}
        onChangeText={onAddressChange}
      />
      {error ? <Text className="text-red-500 text-xs mt-1">{error}</Text> : null}

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
