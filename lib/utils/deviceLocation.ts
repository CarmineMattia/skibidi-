/**
 * Device geolocation helpers for delivery address ("Usa la mia posizione").
 */
import { Platform } from 'react-native';
import type { GeoCoordinates } from '@/lib/utils/geocoding';

export type DeviceLocationResult =
  | { ok: true; coordinates: GeoCoordinates }
  | { ok: false; message: string };

export async function getCurrentDeviceCoordinates(): Promise<DeviceLocationResult> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60_000,
        });
      });
      return {
        ok: true,
        coordinates: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
      };
    }

    const Location = await import('expo-location');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return {
        ok: false,
        message: 'Serve il permesso posizione per riempire l’indirizzo automaticamente.',
      };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      ok: true,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
    };
  } catch {
    return {
      ok: false,
      message: 'Non riesco a leggere la posizione. Controlla i permessi o digita l’indirizzo.',
    };
  }
}
