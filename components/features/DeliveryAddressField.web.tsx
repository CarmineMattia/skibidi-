import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from '@/components/ui/map';
import {
  reverseGeocode,
  searchAddresses,
  type AddressSuggestion,
  type GeoCoordinates,
} from '@/lib/utils/geocoding';
import type { MapMouseEvent } from 'maplibre-gl';
import { MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const DEFAULT_CENTER: GeoCoordinates = { lng: 12.4964, lat: 41.9028 };
const DEFAULT_ZOOM = 13;

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

function MapLocationSync({
  coordinates,
  onMapClick,
}: {
  coordinates: GeoCoordinates;
  onMapClick: (coordinates: GeoCoordinates) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.flyTo({ center: [coordinates.lng, coordinates.lat], zoom: Math.max(map.getZoom(), 15) });
  }, [coordinates.lat, coordinates.lng, isLoaded, map]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleClick = (event: MapMouseEvent) => {
      onMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [isLoaded, map, onMapClick]);

  return null;
}

export function DeliveryAddressField({
  label,
  placeholder,
  address,
  onAddressChange,
  error,
  hasError,
  mapHint = 'Tap the map or drag the pin to set your delivery location.',
  searchingLabel = 'Searching addresses...',
}: DeliveryAddressFieldProps) {
  const [coordinates, setCoordinates] = useState<GeoCoordinates>(DEFAULT_CENTER);
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

    const trimmed = address.trim();
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
  }, [address]);

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

      <View className="mt-3 rounded-xl border border-border overflow-hidden bg-card">
        <View className="h-[220px] w-full">
          <Map center={[DEFAULT_CENTER.lng, DEFAULT_CENTER.lat]} zoom={DEFAULT_ZOOM} className="h-full w-full">
            <MapControls
              showZoom
              showLocate
              onLocate={(coords) => {
                void applyCoordinates({ lng: coords.longitude, lat: coords.latitude });
              }}
            />
            <MapLocationSync coordinates={coordinates} onMapClick={applyCoordinates} />
            <MapMarker
              draggable
              longitude={coordinates.lng}
              latitude={coordinates.lat}
              onDragEnd={(lngLat) => {
                void applyCoordinates({ lng: lngLat.lng, lat: lngLat.lat });
              }}
            >
              <MarkerContent className="cursor-move">
                <MapPin className="fill-[#8d171e] stroke-white" size={30} />
              </MarkerContent>
            </MapMarker>
          </Map>
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
