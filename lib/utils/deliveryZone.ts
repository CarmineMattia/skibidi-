/**
 * Delivery area for Ambrosia: Montecchio Emilia and Villa Aiola (RE).
 */

export const DELIVERY_ZONE_POSTCODE = '42027';

export const DELIVERY_ZONE_MESSAGE_IT =
  'Le consegne sono possibili solo a Montecchio Emilia e Villa Aiola.';

export const DELIVERY_ZONE_MESSAGE_EN =
  'Delivery is only possible in Montecchio Emilia and Villa Aiola.';

/**
 * Bounding box covering Montecchio Emilia comune, including Villa Aiola.
 * Source: OSM relation for the comune (lat 44.674–44.744, lon 10.418–10.503)
 * with a small margin.
 */
export const DELIVERY_ZONE_BOUNDS = {
  minLon: 10.415,
  maxLon: 10.506,
  minLat: 44.672,
  maxLat: 44.746,
} as const;

const DISALLOWED_LOCALITY_PATTERN =
  /\b(reggio emilia|reggio nell emilia|parma|modena|milano|bologna|roma|sant ilario|santilario|cavriago|bibbiano|montecchio maggiore|gattatico|campegine|correggio|guastalla|scandiano|rubiera|casalgrande|albinea|quattro castella|canossa|san polo|vedriano|barco|boretto|brescello|novellara|rio salvo)\b/;

export function normalizeDeliveryAddress(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isCoordinatesInDeliveryZone(coordinates: { lat: number; lng: number }): boolean {
  return (
    coordinates.lng >= DELIVERY_ZONE_BOUNDS.minLon &&
    coordinates.lng <= DELIVERY_ZONE_BOUNDS.maxLon &&
    coordinates.lat >= DELIVERY_ZONE_BOUNDS.minLat &&
    coordinates.lat <= DELIVERY_ZONE_BOUNDS.maxLat
  );
}

function hasAllowedLocality(normalized: string): boolean {
  if (normalized.includes(DELIVERY_ZONE_POSTCODE)) return true;
  if (normalized.includes('montecchio emilia')) return true;
  if (normalized.includes('villa aiola')) return true;
  if (/\baiola\b/.test(normalized) && !normalized.includes('montecchio maggiore')) {
    return true;
  }
  return false;
}

function looksLikePlaceName(value: string): boolean {
  return /[a-z]{3,}/.test(value) && !/^\d+[a-z]?$/.test(value);
}

export function isAddressInDeliveryZone(address: string): boolean {
  const normalized = normalizeDeliveryAddress(address);
  if (!normalized) return false;
  return hasAllowedLocality(normalized);
}

/** True when the user has typed a locality that is clearly outside the zone. */
export function looksLikeOutOfDeliveryZone(address: string): boolean {
  if (isAddressInDeliveryZone(address)) return false;
  const normalized = normalizeDeliveryAddress(address);
  if (!normalized) return false;
  if (DISALLOWED_LOCALITY_PATTERN.test(normalized)) return true;

  const parts = address
    .split(',')
    .map((part) => normalizeDeliveryAddress(part))
    .filter(Boolean);
  const placeParts = parts.filter(looksLikePlaceName);
  const localityCandidates = placeParts.slice(1);
  if (localityCandidates.length === 0) return false;
  return localityCandidates.some((part) => !hasAllowedLocality(part));
}

/** Adds Montecchio Emilia when the customer typed a street without a town. */
export function finalizeDeliveryAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return trimmed;
  const normalized = normalizeDeliveryAddress(trimmed);
  if (hasAllowedLocality(normalized) || looksLikeOutOfDeliveryZone(trimmed)) {
    return trimmed;
  }
  return `${trimmed}, Montecchio Emilia`;
}

export function getDeliveryZoneMessage(language: 'it' | 'en'): string {
  return language === 'en' ? DELIVERY_ZONE_MESSAGE_EN : DELIVERY_ZONE_MESSAGE_IT;
}
