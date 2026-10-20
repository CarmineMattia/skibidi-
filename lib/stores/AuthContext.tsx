/**
 * Auth Context
 * Gestione autenticazione e ruoli utente
 */

import { supabase } from '@/lib/api/supabase';
import type { UserRole } from '@/types';
import type { Profile } from '@/types/database.types';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const LEGACY_GUEST_FLAG_KEY = 'skibidi_lastLoginAsGuest';
const KIOSK_FLAG_KEY = 'skibidi_kioskModeEnabled';

// Target del redirect OAuth nelle build native (deep link dell'app).
const NATIVE_REDIRECT_URL = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? 'pizzeriaambrosia://login';

/**
 * Login admin con email+password: disattivato di default.
 * Si accende solo con EXPO_PUBLIC_ENABLE_ADMIN_PASSWORD_LOGIN=true ed è
 * raggiungibile solo da /login?admin=1. Chi entra senza ruolo admin viene
 * disconnesso subito.
 */
export const ADMIN_PASSWORD_LOGIN_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_ADMIN_PASSWORD_LOGIN === 'true';

/** Hook Facebook predisposto ma spento finché non viene configurato il provider. */
export const FACEBOOK_LOGIN_ENABLED = process.env.EXPO_PUBLIC_ENABLE_FACEBOOK_LOGIN === 'true';

export type OAuthProviderId = 'google' | 'facebook';

function getOAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    const origin = globalThis?.window?.location?.origin ?? '';
    // /login: l'AuthGuard reindirizza gli utenti autenticati verso il menu
    return `${origin}/login`;
  }
  return NATIVE_REDIRECT_URL;
}

function getStorage(): Storage | null {
  try {
    const globalObject: any = globalThis as any;
    if (globalObject && globalObject.localStorage) {
      return globalObject.localStorage as Storage;
    }
  } catch {
    // localStorage non disponibile (es. ambiente native)
  }
  return null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  userRole: UserRole;
  isLoading: boolean;
  isKioskMode: boolean;
   isAuthenticated: boolean;

  // Role checks
  isAdmin: boolean;
  isCustomer: boolean;

  // Auth actions
  /** Login OAuth (Google; Facebook solo se abilitato). */
  signInWithOAuth: (provider?: OAuthProviderId) => Promise<void>;
  /** Solo admin, dietro flag: vedi ADMIN_PASSWORD_LOGIN_ENABLED. */
  signInAdminWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Mode switching
  enterKioskMode: () => void;
  exitKioskMode: () => void;
  setUserRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('kiosk');
  const [isLoading, setIsLoading] = useState(true);
  const [isKioskMode, setIsKioskMode] = useState(true);

  const applyStoredAnonymousMode = () => {
    // Nessun utente loggato: solo navigazione del menu, niente ordini.
    // Pulisce l'eventuale flag ospite rimasto da versioni precedenti.
    getStorage()?.removeItem(LEGACY_GUEST_FLAG_KEY);
    setIsKioskMode(true);
    setUserRole('kiosk');
    setIsLoading(false);
  };

  const saveKioskFlag = (value: boolean) => {
    const storage = getStorage();
    if (!storage) return;
    if (value) {
      storage.setItem(KIOSK_FLAG_KEY, 'true');
    } else {
      storage.removeItem(KIOSK_FLAG_KEY);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch user role from profiles table
        fetchUserRole(session.user);
        setIsKioskMode(false);
      } else {
        applyStoredAnonymousMode();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user);
        setIsKioskMode(false);
      } else {
        setUserRole('kiosk');
        applyStoredAnonymousMode();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, full_name, created_at, updated_at, company_id')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid error on no rows

      if (error) {
        console.error('Error fetching user role:', error);
        throw error;
      }

      if (data) {
        console.log('Profile found:', data.role);
        const profileData: Profile = {
          id: data.id,
          role: data.role as UserRole,
          email: data.email || undefined,
          full_name: data.full_name || undefined,
          // phone/address are optional and may not exist in every DB migration state
          phone: undefined,
          address: undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
          company_id: data.company_id ?? undefined,
        };
        setProfile(profileData);
        setUserRole(profileData.role);
      } else {
        // Self-healing: Profile missing, create it
        console.log('Profile missing for user, creating default profile...');
        const metadata = user.user_metadata || {};
        // role is never taken from client-controlled metadata — the DB trigger
        // would reject it anyway, and new self-healed profiles are always 'customer'.
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: metadata.full_name,
          role: 'customer',
        });

        if (insertError) {
          console.error('Error creating profile authomatically:', insertError);
          setUserRole('customer');
          setProfile(null);
        } else {
          // Retry fetch after creation
          console.log('Profile created, retrying fetch...');
          const { data: newData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (newData) {
            const newProfile: Profile = {
              id: newData.id,
              role: newData.role as UserRole,
              email: newData.email || undefined,
              full_name: newData.full_name || undefined,
              phone: newData.phone || undefined,
              address: newData.address || undefined,
              created_at: newData.created_at,
              updated_at: newData.updated_at,
            };
            setProfile(newProfile);
            setUserRole(newProfile.role);
          }
        }
      }
    } catch (error) {
      console.error('Exception in fetchUserRole:', error);
      setUserRole('customer');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithOAuth = async (provider: OAuthProviderId = 'google') => {
    if (provider === 'facebook' && !FACEBOOK_LOGIN_ENABLED) {
      throw new Error('Accesso con Facebook non disponibile.');
    }
    const redirectTo = getOAuthRedirectUrl();

    if (Platform.OS === 'web') {
      // Redirect completo verso il provider; al ritorno su /login il client
      // (detectSessionInUrl) scambia il codice e apre la sessione.
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
        },
      });
      if (error) throw error;
      return;
    }

    // Nativo: apre il browser di sistema e rientra col deep link
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('URL di accesso non disponibile.');

    const WebBrowser = await import('expo-web-browser');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) return; // annullato dall'utente

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return;
    }
    // Flusso implicito: token nell'hash
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) throw sessionError;
      return;
    }
    const providerError = url.searchParams.get('error_description') ?? hash.get('error_description');
    throw new Error(providerError ?? 'Accesso non completato.');
  };

  const signInAdminWithPassword = async (email: string, password: string) => {
    if (!ADMIN_PASSWORD_LOGIN_ENABLED) {
      throw new Error('Accesso con password disattivato.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileRow?.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('Questo accesso è riservato agli amministratori. Usa Google.');
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Reset state on sign out
    setProfile(null);
    setUserRole('kiosk');
    setIsKioskMode(true);
    saveKioskFlag(true);
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) throw error;
  };

  const enterKioskMode = () => {
    setIsKioskMode(true);
    setUserRole('kiosk');
    setProfile(null);
    saveKioskFlag(true);
  };

  const exitKioskMode = () => {
    setIsKioskMode(false);
    if (!session) {
      setUserRole('kiosk');
    }
    saveKioskFlag(false);
  };

  const updateUserRole = async (newRole: UserRole) => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);

    if (error) throw error;

    // Update local state
    setUserRole(newRole);
    if (profile) {
      setProfile({ ...profile, role: newRole });
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    userRole,
    isLoading,
    isKioskMode,
    isAuthenticated: !!session && !!user,
    isAdmin: userRole === 'admin',
    isCustomer: userRole === 'customer',
    signInWithOAuth,
    signInAdminWithPassword,
    signOut,
    enterKioskMode,
    exitKioskMode,
    setUserRole: updateUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
