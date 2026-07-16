/**
 * Supabase Client
 * Configurazione client Supabase con TypeScript types
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/types/database.types.generated';

// TODO: Sostituire con le vostre credenziali Supabase
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️  Supabase credentials not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persistenza automatica della sessione
    autoRefreshToken: true,
    persistSession: true,
    // Su web il magic link rientra con i token nell'hash dell'URL e il client
    // li consuma da solo; su nativo il passwordless usa il codice OTP a 6 cifre
    detectSessionInUrl: Platform.OS === 'web',
    // Su nativo senza storage esplicito la sessione vive solo in memoria
    // e si perde al riavvio; su web resta il default (localStorage)
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
  },
});
