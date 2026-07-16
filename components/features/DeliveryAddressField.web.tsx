import {
  DEFAULT_MAP_CENTER,
  reverseGeocode,
  searchAddresses,
  type AddressSuggestion,
  type GeoCoordinates,
} from '@/lib/utils/geocoding';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

// Lazy chunk: maplibre-gl (WebGL) stays out of the initial checkout bundle.
// The Suspense fallback fills the same reserved 220 px box, so the map
// arriving late never shifts the layout.
const DeliveryMapSection = lazy(() => import('@/components/features/DeliveryMapSection'));

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
  mapHint = 'Tap the map or drag the pin to set your delivery location.',
  searchingLabel = 'Searching addresses...',
}: DeliveryAddressFieldProps) {
  const [coordinates, setCoordinates] = useState<GeoCoordinates>(DEFAULT_MAP_CENTER);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const skipSearchRef = useRef(false);
  const searchRequestRef = useRef(0);

  const applyCoordinates = useCallback(
    async (nextCoordinates: GeoCoordinates, options?: { skipReverse?: boolean }) => {
      setCoordinates(nextCoordinates);

      if (options?.skipReverse) return;

      setIsResolvingLocation(true);
      try {
        const resolvedAddress = await reverseGeocode(nextCoordinates);
        skipSearchRef.current = true;
        onAddressChange(resolvedAddress);
      } catch {
        // Keep the typed address if reverse geocoding fails.
      } finally {
        setIsResolvingLocation(false);
      }
    },
    [onAddressChange],
  );

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const trimmed = [address.trim(), civico.trim()].filter(Boolean).join(' ');
    if (trimmed.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setIsSearching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchAddresses(trimmed, { countryCode: 'it', limit: 5 });
        if (searchRequestRef.current !== requestId) return;
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        if (searchRequestRef.current !== requestId) return;
        setSuggestions([]);
      } finally {
        if (searchRequestRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [address, civico]);

  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    skipSearchRef.current = true;
    onAddressChange(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
    void applyCoordinates(suggestion.coordinates, { skipReverse: true });
  };

  return (
    <View>
      <Text className="text-sm font-medium mb-2">{label}</Text>

      <View className="relative z-20">
        <TextInput
          className={`bg-background border rounded-xl px-4 py-3 text-base min-h-[80px] ${
            hasError ? 'border-red-500 bg-red-50' : 'border-border'
          }`}
          placeholder={placeholder}
          multiline
          value={address}
          onChangeText={(value) => {
            setShowSuggestions(true);
            onAddressChange(value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150);
          }}
        />

        {showSuggestions && suggestions.length > 0 ? (
          <View className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-30">
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion.id}
                className="w-full border-b border-border bg-card px-4 py-3 last:border-b-0 active:bg-muted"
                onPress={() => handleSuggestionSelect(suggestion)}
              >
                <Text className="text-sm text-foreground">{suggestion.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {isSearching ? <Text className="text-xs text-muted-foreground mt-1">{searchingLabel}</Text> : null}
      {error ? <Text className="text-red-500 text-xs mt-1">{error}</Text> : null}

      <Text className="text-sm font-medium mb-2 mt-3">{civicoLabel}</Text>
      <TextInput
        className={`bg-background border rounded-xl px-4 py-3 text-base ${
          hasCivicoError ? 'border-red-500 bg-red-50' : 'border-border'
        }`}
        placeholder={civicoPlaceholder}
        value={civico}
        onChangeText={onCivicoChange}
        autoCapitalize="characters"
      />
      {civicoError ? <Text className="text-red-500 text-xs mt-1">{civicoError}</Text> : null}

      <View className="mt-3 rounded-xl border border-border overflow-hidden bg-card">
        <View className="h-[220px] w-full">
          <Suspense fallback={<View className="h-full w-full bg-secondary/30 animate-pulse" />}>
            <DeliveryMapSection
              coordinates={coordinates}
              onApplyCoordinates={(coords) => {
                void applyCoordinates(coords);
              }}
            />
          </Suspense>
        </View>
        <View className="px-3 py-2 border-t border-border bg-background">
          <Text className="text-xs text-muted-foreground">
            {isResolvingLocation ? searchingLabel : mapHint}
          </Text>
        </View>
      </View>
    </View>
  );
}
