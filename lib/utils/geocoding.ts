const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SkibidiOrders/1.0 (delivery address picker)';

export type GeoCoordinates = {
  lng: number;
  lat: number;
};

/** Centro di Montecchio Emilia — area di consegna predefinita sulla mappa */
export const DEFAULT_MAP_CENTER: GeoCoordinates = { lng: 10.667, lat: 44.6997 };

export type AddressSuggestion = {
  id: string;
  label: string;
  coordinates: GeoCoordinates;
};

type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type NominatimReverseResult = {
  display_name: string;
};

async function nominatimFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${NOMINATIM_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function formatShortAddress(displayName: string): string {
  const parts = displayName.split(',').map((part) => part.trim());
  return parts.slice(0, 4).join(', ');
}

export async function searchAddresses(
  query: string,
  options?: { countryCode?: string; limit?: number },
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(options?.limit ?? 5),
  });

  if (options?.countryCode) {
    params.set('countrycodes', options.countryCode);
  }

  const results = await nominatimFetch<NominatimSearchResult[]>(`/search?${params.toString()}`);

  return results.map((result) => ({
    id: String(result.place_id),
    label: formatShortAddress(result.display_name),
    coordinates: {
      lng: Number(result.lon),
      lat: Number(result.lat),
    },
  }));
}

export async function reverseGeocode(coordinates: GeoCoordinates): Promise<string> {
  const params = new URLSearchParams({
    lat: String(coordinates.lat),
    lon: String(coordinates.lng),
    format: 'json',
  });

  const result = await nominatimFetch<NominatimReverseResult>(`/reverse?${params.toString()}`);
  return formatShortAddress(result.display_name);
}
