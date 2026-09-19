import { Linking, Platform } from 'react-native';

/**
 * Apre l'app Satispay se installata; altrimenti la pagina download.
 * Non esiste un deep link ufficiale "cerca negozio per nome".
 */
export async function openSatispayApp(): Promise<void> {
  const candidates =
    Platform.OS === 'web'
      ? ['satispay://', 'https://www.satispay.com/it-it/download/']
      : ['satispay://', 'satispay:', 'https://www.satispay.com/it-it/download/'];

  for (const url of candidates) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can || url.startsWith('http')) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // prova il successivo
    }
  }
}
