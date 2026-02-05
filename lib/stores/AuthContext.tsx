/**
 * Auth Context
 * Gestione autenticazione e ruoli utente
 */

import { supabase } from '@/lib/api/supabase';
import type { UserRole } from '@/types';
import type { Profile } from '@/types/database.types';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';



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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;

  // Mode switching
  enterKioskMode: () => void;
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
        setIsLoading(false);
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
        setIsKioskMode(true);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, full_name, phone, address, created_at, updated_at')
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
          phone: data.phone || undefined,
          address: data.address || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setProfile(profileData);
        setUserRole(profileData.role);
      } else {
        // Self-healing: Profile missing, create it
        console.log('Profile missing for user, creating default profile...');
        const metadata = user.user_metadata || {};
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: metadata.full_name,
          role: (metadata.role as UserRole) || 'customer',
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    role: UserRole = 'customer'
  ) => {
    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (signUpError) throw signUpError;

    // Create profile if signUp was successful
    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
      });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Don't throw - profile might already exist from trigger
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Reset state on sign out
    setProfile(null);
    setUserRole('kiosk');
    setIsKioskMode(true);
  };

  const enterKioskMode = () => {
    setIsKioskMode(true);
    setUserRole('kiosk');
    setProfile(null);
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
    signIn,
    signUp,
    signOut,
    enterKioskMode,
    setUserRole: updateUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
