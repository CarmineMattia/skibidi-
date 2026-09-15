import {
  DEFAULT_MAP_CENTER,
  reverseGeocode,
  searchAddresses,
  type AddressSuggestion,
  type GeoCoordinates,
} from '@/lib/utils/geocoding';
import {
  getDeliveryZoneMessage,
  isAddressInDeliveryZone,
  isCoordinatesInDeliveryZone,
  looksLikeOutOfDeliveryZone,
} from '@/lib/utils/deliveryZone';
import { useAppSettings } from '@/lib/stores/AppSettingsContext';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentDeviceCoordinates } from '@/lib/utils/deviceLocation';
import { FontAwesome } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

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
  mapHint = 'Tap the map or drag the pin to set your delivery location.',
  searchingLabel = 'Searching addresses...',
  hint,
}: DeliveryAddressFieldProps) {
  const { language } = useAppSettings();
  const zoneMessage = getDeliveryZoneMessage(language === 'en' ? 'en' : 'it');
  const [coordinates, setCoordinates] = useState<GeoCoordinates>(DEFAULT_MAP_CENTER);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const skipSearchRef = useRef(false);
  const searchRequestRef = useRef(0);

  const applyCoordinates = useCallback(
    async (nextCoordinates: GeoCoordinates, options?: { skipReverse?: boolean }) => {
      if (!isCoordinatesInDeliveryZone(nextCoordinates)) {
        setZoneError(zoneMessage);
        return;
      }

      setCoordinates(nextCoordinates);

      if (options?.skipReverse) {
        setZoneError(null);
        return;
      }

      setIsResolvingLocation(true);
      try {
        const resolvedAddress = await reverseGeocode(nextCoordinates);
        if (!isAddressInDeliveryZone(resolvedAddress)) {
          setZoneError(zoneMessage);
          return;
        }
        skipSearchRef.current = true;
        setZoneError(null);
        onAddressChange(resolvedAddress);
      } catch {
        // Keep the typed address if reverse geocoding fails.
      } finally {
        setIsResolvingLocation(false);
      }
    },
    [onAddressChange, zoneMessage],
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
    if (
      !isCoordinatesInDeliveryZone(suggestion.coordinates) ||
      !isAddressInDeliveryZone(suggestion.label)
    ) {
      setZoneError(zoneMessage);
      return;
    }
    skipSearchRef.current = true;
    setZoneError(null);
    onAddressChange(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
    void applyCoordinates(suggestion.coordinates, { skipReverse: true });
  };

  const handleUseMyLocation = async () => {
    setLocateError(null);
    setIsLocating(true);
    try {
      const result = await getCurrentDeviceCoordinates();
      if (!result.ok) {
        setLocateError(result.message);
        return;
      }
      await applyCoordinates(result.coordinates);
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between mb-2 gap-3">
        <Text className="text-base font-semibold text-foreground flex-1">{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usa la mia posizione"
          className="flex-row items-center gap-2 rounded-full bg-primary/10 px-4 py-2.5 active:opacity-80"
          onPress={() => {
            void handleUseMyLocation();
          }}
          disabled={isLocating || isResolvingLocation}
        >
          {isLocating || isResolvingLocation ? (
            <ActivityIndicator size="small" color="#8d171e" />
          ) : (
            <FontAwesome name="location-arrow" size={14} color="#8d171e" />
          )}
          <Text className="text-sm font-bold text-primary">
            {isLocating || isResolvingLocation ? 'Cerco…' : 'Usa posizione'}
          </Text>
        </Pressable>
      </View>

      <View className="relative z-20">
        <TextInput
          className={`bg-background border rounded-2xl px-4 py-4 text-base leading-6 min-h-[88px] ${
            hasError || zoneError ? 'border-red-500 bg-red-50' : 'border-border'
          }`}
          placeholder={placeholder}
          multiline
          value={address}
          onChangeText={(value) => {
            setShowSuggestions(true);
            setLocateError(null);
            setZoneError(looksLikeOutOfDeliveryZone(value) ? zoneMessage : null);
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
      {error || zoneError || locateError ? (
        <Text className="text-red-600 text-sm font-semibold mt-2">{error || zoneError || locateError}</Text>
      ) : (
        <Text className="text-sm text-muted-foreground mt-2 leading-5">{hint || zoneMessage}</Text>
      )}

      <Text className="text-base font-semibold text-foreground mb-2 mt-5">{civicoLabel}</Text>
      <TextInput
        className={`bg-background border rounded-2xl px-4 py-4 text-base ${
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
