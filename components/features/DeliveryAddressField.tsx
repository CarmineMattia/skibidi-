import { Text, TextInput, View } from 'react-native';

type DeliveryAddressFieldProps = {
  label: string;
  placeholder: string;
  address: string;
  onAddressChange: (value: string) => void;
  error?: string;
  hasError?: boolean;
  mapHint?: string;
  searchingLabel?: string;
};

export function DeliveryAddressField({
  label,
  placeholder,
  address,
  onAddressChange,
  error,
  hasError,
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
    </View>
  );
}
