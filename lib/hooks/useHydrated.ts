import { useLocalSearchParams, type UnknownOutputParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';

/**
 * false durante il render statico (SSR) e il primo render di idratazione sul
 * client, true dopo il mount. Serve per i valori che esistono solo nel browser
 * (dimensioni della finestra, localStorage, Date.now...): usarli prima del mount
 * produce un HTML diverso da quello del server e l'errore React #418.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * Larghezza della finestra sicura per l'idratazione: 0 (come nell'HTML statico,
 * generato senza finestra) fino al mount, poi la larghezza reale.
 */
export function useViewportWidth(): number {
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  return hydrated ? Math.min(width, Dimensions.get('window').width) : 0;
}

const EMPTY_PARAMS = Object.freeze({});

/**
 * Query string sicura per l'idratazione: l'HTML statico di ogni pagina è
 * generato senza query string (es. /order-tracking, non ?orderId=...), quindi
 * fino al mount restituisce {} come sul server, poi i parametri veri.
 */
export function useHydratedSearchParams<T extends UnknownOutputParams>(): Partial<T> {
  const params = useLocalSearchParams<T>() as Partial<T>;
  const hydrated = useHydrated();
  return hydrated ? params : (EMPTY_PARAMS as Partial<T>);
}
