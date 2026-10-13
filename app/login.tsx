/**
 * Login Screen
 * Accesso solo con Google (Supabase OAuth). Facebook è predisposto ma spento.
 * Un login admin con email+password esiste solo dietro flag
 * (EXPO_PUBLIC_ENABLE_ADMIN_PASSWORD_LOGIN) ed è raggiungibile da /login?admin=1.
 */

import { Button } from '@/components/ui/Button';
import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import {
  ADMIN_PASSWORD_LOGIN_ENABLED,
  FACEBOOK_LOGIN_ENABLED,
  useAuth,
  type OAuthProviderId,
} from '@/lib/stores/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

function getOAuthErrorMessage(error: unknown): string {
  const err = error as { message?: string };
  const msg = err?.message?.toLowerCase() ?? '';
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return 'Accesso con Google non ancora attivo. Riprova più tardi.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Errore di connessione. Riprova.';
  }
  return err?.message || 'Si è verificato un errore. Riprova.';
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ admin?: string }>();
  const showAdminLogin = ADMIN_PASSWORD_LOGIN_ENABLED && params.admin === '1';

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const { signInWithOAuth, signInAdminWithPassword } = useAuth();

  // Errori di ritorno dal provider OAuth (es. accesso negato) arrivano nell'URL
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const loc = globalThis?.window?.location;
    if (!loc) return;
    const all = `${loc.search}&${loc.hash.replace(/^#/, '')}`;
    const p = new URLSearchParams(all);
    const description = p.get('error_description');
    if (p.get('error') || description) {
      setErrorMessage(
        p.get('error') === 'access_denied'
          ? 'Accesso annullato. Riprova con il tuo account Google.'
          : description || 'Accesso non riuscito. Riprova.'
      );
      globalThis.window.history.replaceState(null, '', loc.pathname);
    }
  }, []);

  const handleOAuth = async (provider: OAuthProviderId) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await signInWithOAuth(provider);
      // Web: la pagina viene rediretta al provider. Nativo: onAuthStateChange
      // aggiorna la sessione e l'AuthGuard porta al menu.
    } catch (error) {
      console.error('OAuth error:', error);
      setErrorMessage(getOAuthErrorMessage(error));
    } finally {
      if (Platform.OS !== 'web') setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setErrorMessage(null);
    if (!adminEmail.trim() || !adminPassword) {
      setErrorMessage('Inserisci email e password');
      return;
    }
    setIsLoading(true);
    try {
      await signInAdminWithPassword(adminEmail, adminPassword);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Accesso non riuscito.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-8">
          <Image
            source={BRAND_LOGO}
            style={{ width: 128, height: 64, marginBottom: 12 }}
            resizeMode="contain"
            accessibilityLabel={BRAND.name}
          />
          <Text className="text-foreground font-bold text-4xl mb-2">{BRAND.name}</Text>
          <Text className="text-muted-foreground text-lg">{BRAND.tagline}</Text>
        </View>

        <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
          <Text className="text-card-foreground font-semibold text-xl mb-2">Accedi</Text>
          <Text className="text-muted-foreground text-sm mb-6">
            Per ordinare serve un account. Accedi con Google: niente password da ricordare.
          </Text>

          {errorMessage && (
            <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4 flex-row items-center gap-2">
              <FontAwesome name="exclamation-circle" size={16} color="#ef4444" />
              <Text className="text-destructive text-sm font-medium flex-1">{errorMessage}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continua con Google"
            onPress={() => handleOAuth('google')}
            disabled={isLoading}
            className="flex-row items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 active:opacity-80"
          >
            <FontAwesome name="google" size={18} color="#4285F4" />
            <Text className="text-base font-semibold text-gray-900">
              {isLoading ? 'Reindirizzamento…' : 'Continua con Google'}
            </Text>
          </Pressable>

          {FACEBOOK_LOGIN_ENABLED && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continua con Facebook"
              onPress={() => handleOAuth('facebook')}
              disabled={isLoading}
              className="mt-3 flex-row items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 active:opacity-80"
            >
              <FontAwesome name="facebook" size={18} color="#ffffff" />
              <Text className="text-base font-semibold text-white">Continua con Facebook</Text>
            </Pressable>
          )}

          <Text className="text-muted-foreground text-xs text-center mt-4">
            Il pagamento avviene in cassa al ritiro.
          </Text>
        </View>

        {showAdminLogin && (
          <View className="bg-card rounded-2xl p-6 border border-border mb-6">
            <Text className="text-card-foreground font-semibold text-base mb-3">Accesso amministratore</Text>
            <TextInput
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
              placeholder="Email admin"
              value={adminEmail}
              onChangeText={setAdminEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />
            <TextInput
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
              placeholder="Password"
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
              editable={!isLoading}
              onSubmitEditing={handleAdminLogin}
            />
            <Button
              title={isLoading ? 'Accesso in corso...' : 'Accedi come admin'}
              variant="default"
              size="lg"
              onPress={handleAdminLogin}
              className="w-full"
              disabled={isLoading}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
