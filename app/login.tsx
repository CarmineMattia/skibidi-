/**
 * Login Screen
 * Authentication with role selection
 */

import { Button } from '@/components/ui/Button';
import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import { useAuth } from '@/lib/stores/AuthContext';
import type { UserRole } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';

type AuthMode = 'login' | 'signup';
type AuthView = 'otp' | 'otp-verify' | 'password';

// Cooldown reinvio allineato al rate limit per indirizzo di Supabase (max_frequency)
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function getOtpErrorMessage(error: unknown): string {
  const err = error as { code?: string; status?: number; message?: string };
  const code = err?.code ?? '';
  const msg = err?.message?.toLowerCase() ?? '';

  if (code === 'over_email_send_rate_limit' || err?.status === 429 || msg.includes('rate limit')) {
    return 'Troppe richieste. Attendi qualche minuto e riprova.';
  }
  if (code === 'otp_expired' || (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid')))) {
    return 'Codice non valido o scaduto. Richiedine uno nuovo.';
  }
  if (code === 'otp_disabled') {
    return 'Accesso via email momentaneamente non disponibile.';
  }
  if (code === 'validation_failed' || (msg.includes('invalid') && msg.includes('email'))) {
    return 'Inserisci un indirizzo email valido.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Errore di connessione. Riprova.';
  }
  return 'Si è verificato un errore. Riprova.';
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: string }[] = [
  {
    value: 'admin',
    label: 'Admin / Cassa',
    description: 'Accesso completo a tutte le funzionalità',
    icon: 'briefcase',
  },
  {
    value: 'customer',
    label: 'Cliente',
    description: 'Visualizza menu e ordini personali',
    icon: 'user',
  },
];

export default function LoginScreen() {
  const [authView, setAuthView] = useState<AuthView>('otp');
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email a cui è stato inviato il codice, congelata al momento dell'invio
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const { signIn, signUp, requestOtp, verifyEmailOtp, resendConfirmationEmail, enterGuestMode } = useAuth();
  const router = useRouter();

  // Countdown reinvio codice
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Un magic link scaduto o già consumato (es. da scanner antispam aziendali)
  // riatterra qui con l'errore nell'hash dell'URL
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = globalThis?.window?.location?.hash ?? '';
    if (!hash) return;

    if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
      setErrorMessage(
        'Link di accesso scaduto o già usato. Inserisci la tua email per ricevere un nuovo codice.'
      );
      globalThis.window.history.replaceState(null, '', globalThis.window.location.pathname);
    }
  }, []);

  const switchView = (view: AuthView) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setAuthView(view);
  };

  const handleRequestOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Inserisci un indirizzo email valido');
      return;
    }

    setIsLoading(true);
    try {
      await requestOtp(trimmedEmail);
      setOtpEmail(trimmedEmail);
      setOtpCode('');
      setResendIn(OTP_RESEND_COOLDOWN_SECONDS);
      setAuthView('otp-verify');
    } catch (error) {
      console.error('OTP request error:', error);
      setErrorMessage(getOtpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || isLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      await requestOtp(otpEmail);
      setResendIn(OTP_RESEND_COOLDOWN_SECONDS);
      setSuccessMessage(`Nuovo codice inviato a ${otpEmail}.`);
    } catch (error) {
      console.error('OTP resend error:', error);
      setErrorMessage(getOtpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedCode = otpCode.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrorMessage('Inserisci il codice a 6 cifre ricevuto via email');
      return;
    }

    setIsLoading(true);
    try {
      await verifyEmailOtp(otpEmail, trimmedCode);
      router.replace('/(tabs)/menu');
    } catch (error) {
      console.error('OTP verify error:', error);
      setErrorMessage(getOtpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Inserisci email e password');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Inserisci un indirizzo email valido');
      return;
    }

    // Password length validation
    if (password.length < 6) {
      setErrorMessage('La password deve contenere almeno 6 caratteri');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMessage('Inserisci il tuo nome');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        router.replace('/(tabs)/menu');
      } else {
        const signUpResult = await signUp(email.trim(), password, fullName.trim(), selectedRole);

        if (signUpResult.requiresEmailConfirmation) {
          setMode('login');
          setPassword('');
          setPendingConfirmationEmail(signUpResult.email);
          setSuccessMessage(
            `Ti abbiamo inviato un'email di conferma a ${signUpResult.email}. Conferma l'account e poi effettua il login.`
          );
        } else {
          // In case autoconfirm is enabled in Supabase settings.
          router.replace('/(tabs)/menu');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);

      // Parse Supabase error messages
      let msg = error.message ? error.message.toLowerCase() : '';
      let displayError = 'Si è verificato un errore. Riprova.';

      // Invalid login credentials
      if (msg.includes('invalid') && msg.includes('credentials')) {
        displayError = 'Email o password non corretti.';
      }
      // Invalid email format
      else if (msg.includes('invalid') && msg.includes('email')) {
        displayError = 'Inserisci un indirizzo email valido.';
      }
      // User already registered
      else if (msg.includes('already') && msg.includes('registered')) {
        displayError = 'Email già registrata. Prova ad accedere.';
      }
      // User already exists
      else if (msg.includes('user') && msg.includes('already') && msg.includes('exists')) {
        displayError = 'Account esistente. Usa il login.';
      }
      // Weak password
      else if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) {
        displayError = 'Password troppo debole (min 6 caratteri).';
      }
      // Email not confirmed
      else if (msg.includes('email') && msg.includes('not') && msg.includes('confirmed')) {
        displayError = 'Email non confermata. Controlla la posta.';
      }
      // Network error
      else if (msg.includes('network') || msg.includes('fetch')) {
        displayError = 'Errore di connessione. Riprova.';
      }
      // Database error
      else if (msg.includes('database')) {
        displayError = 'Errore del server. Riprova più tardi.';
      }
      // Generic error with message
      else if (error.message) {
        displayError = error.message;
      }

      setErrorMessage(displayError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) {
      setErrorMessage('Nessuna email da riconfermare. Effettua prima la registrazione.');
      return;
    }

    setErrorMessage(null);
    setIsResendingConfirmation(true);
    try {
      await resendConfirmationEmail(pendingConfirmationEmail);
      setSuccessMessage(
        `Email di conferma reinviata a ${pendingConfirmationEmail}. Controlla anche la cartella spam.`
      );
    } catch (error: any) {
      let message = 'Impossibile reinviare l\'email di conferma. Riprova.';
      if (error?.message) {
        message = error.message;
      }
      setErrorMessage(message);
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const openWebmail = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setErrorMessage('Impossibile aprire il link della webmail.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      setErrorMessage('Impossibile aprire il link della webmail.');
    }
  };

  const handleGuestLogin = () => {
    enterGuestMode();
    router.replace('/(tabs)/menu');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo/Title */}
        <View className="items-center mb-8">
          <Image
            source={BRAND_LOGO}
            style={{ width: 128, height: 64, marginBottom: 12 }}
            resizeMode="contain"
            accessibilityLabel={BRAND.name}
          />
          <Text className="text-foreground font-bold text-4xl mb-2">
            {BRAND.name}
          </Text>
          <Text className="text-muted-foreground text-lg">
            {BRAND.tagline}
          </Text>
        </View>

        {/* Passwordless: richiesta codice */}
        {authView === 'otp' && (
          <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
            <Text className="text-card-foreground font-semibold text-xl mb-2">Accedi</Text>
            <Text className="text-muted-foreground text-sm mb-6">
              Niente password: ti inviamo via email un codice a 6 cifre e un link di accesso.
            </Text>

            {errorMessage && (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4 flex-row items-center gap-2">
                <FontAwesome name="exclamation-circle" size={16} color="#ef4444" />
                <Text className="text-destructive text-sm font-medium flex-1">
                  {errorMessage}
                </Text>
              </View>
            )}

            <View className="mb-4">
              <Text className="text-card-foreground font-medium mb-2">Email</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="esempio@email.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
                returnKeyType="send"
                onSubmitEditing={handleRequestOtp}
              />
            </View>

            <Button
              title={isLoading ? 'Invio in corso...' : 'Inviami il codice di accesso'}
              variant="default"
              size="lg"
              onPress={handleRequestOtp}
              className="w-full"
              disabled={isLoading}
            />

            <Pressable
              className="mt-4 active:opacity-50"
              onPress={() => switchView('password')}
              disabled={isLoading}
            >
              <Text className="text-muted-foreground text-sm text-center underline">
                Accedi con email e password
              </Text>
            </Pressable>
          </View>
        )}

        {/* Passwordless: verifica codice */}
        {authView === 'otp-verify' && (
          <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
            <Text className="text-card-foreground font-semibold text-xl mb-2">
              Controlla la tua email
            </Text>
            <Text className="text-muted-foreground text-sm mb-6">
              {`Codice inviato a ${otpEmail} (controlla anche lo spam). Inserisci il codice qui sotto oppure clicca il link nella mail.`}
            </Text>

            {successMessage && (
              <View className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg mb-4 flex-row items-center gap-2">
                <FontAwesome name="check-circle" size={16} color="#059669" />
                <Text className="text-emerald-700 text-sm font-medium flex-1">
                  {successMessage}
                </Text>
              </View>
            )}

            {errorMessage && (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4 flex-row items-center gap-2">
                <FontAwesome name="exclamation-circle" size={16} color="#ef4444" />
                <Text className="text-destructive text-sm font-medium flex-1">
                  {errorMessage}
                </Text>
              </View>
            )}

            <View className="mb-4">
              <Text className="text-card-foreground font-medium mb-2">Codice a 6 cifre</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-center text-2xl font-bold tracking-widest"
                placeholder="123456"
                placeholderTextColor="#9ca3af"
                value={otpCode}
                onChangeText={(text) => setOtpCode(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                autoFocus
              />
            </View>

            <Button
              title={isLoading ? 'Verifica in corso...' : 'Verifica codice'}
              variant="default"
              size="lg"
              onPress={handleVerifyOtp}
              className="w-full"
              disabled={isLoading || otpCode.length !== 6}
            />

            <View className="flex-row justify-between mt-4">
              <Pressable
                className="active:opacity-50"
                onPress={handleResendOtp}
                disabled={resendIn > 0 || isLoading}
              >
                <Text
                  className={`text-sm underline ${resendIn > 0 ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
                >
                  {resendIn > 0 ? `Invia di nuovo (${resendIn}s)` : 'Invia di nuovo'}
                </Text>
              </Pressable>
              <Pressable
                className="active:opacity-50"
                onPress={() => switchView('otp')}
                disabled={isLoading}
              >
                <Text className="text-muted-foreground text-sm underline">
                  {"Usa un'altra email"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Mode Toggle (solo fallback password) */}
        {authView === 'password' && (
          <View className="flex-row bg-muted/50 rounded-lg p-1 mb-6">
            <Pressable
              className={`flex-1 py-3 rounded-md ${mode === 'login' ? 'bg-primary' : 'bg-transparent'
                }`}
              onPress={() => setMode('login')}
            >
              <Text
                className={`text-center font-bold ${mode === 'login' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`}
              >
                Login
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-3 rounded-md ${mode === 'signup' ? 'bg-primary' : 'bg-transparent'
                }`}
              onPress={() => setMode('signup')}
            >
              <Text
                className={`text-center font-bold ${mode === 'signup' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`}
              >
                Registrati
              </Text>
            </Pressable>
          </View>
        )}

        {/* Login/Signup Form (fallback password) */}
        {authView === 'password' && (
        <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
          <Text className="text-card-foreground font-semibold text-xl mb-6">
            {mode === 'login' ? 'Accedi' : 'Crea Account'}
          </Text>

          {/* Success Message */}
          {successMessage && (
            <View className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg mb-4 gap-2">
              <View className="flex-row items-center gap-2">
                <FontAwesome name="check-circle" size={16} color="#059669" />
                <Text className="text-emerald-700 text-sm font-medium flex-1">
                  {successMessage}
                </Text>
              </View>

              {Platform.OS === 'web' && pendingConfirmationEmail && (
                <View className="flex-row items-center gap-2">
                  <Pressable
                    className="px-2.5 py-1 rounded-md border border-emerald-300 bg-white/70"
                    onPress={() => openWebmail('https://mail.google.com')}
                  >
                    <Text className="text-emerald-800 text-xs font-semibold">Apri Gmail</Text>
                  </Pressable>
                  <Pressable
                    className="px-2.5 py-1 rounded-md border border-emerald-300 bg-white/70"
                    onPress={() => openWebmail('https://outlook.live.com/mail/0/')}
                  >
                    <Text className="text-emerald-800 text-xs font-semibold">Apri Outlook</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {pendingConfirmationEmail && mode === 'login' && (
            <Button
              title={isResendingConfirmation ? 'Invio in corso...' : 'Reinvia email di conferma'}
              variant="outline"
              size="sm"
              onPress={handleResendConfirmation}
              className="mb-4"
              disabled={isLoading || isResendingConfirmation}
            />
          )}

          {/* Error Message */}
          {errorMessage && (
            <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4 flex-row items-center gap-2">
              <FontAwesome name="exclamation-circle" size={16} color="#ef4444" />
              <Text className="text-destructive text-sm font-medium flex-1">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Full Name (signup only) */}
          {mode === 'signup' && (
            <View className="mb-4">
              <Text className="text-card-foreground font-medium mb-2">Nome Completo</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="Mario Rossi"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                editable={!isLoading}
                returnKeyType="next"
                onSubmitEditing={() => emailInputRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          )}

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-card-foreground font-medium mb-2">Email</Text>
            <TextInput
              ref={emailInputRef}
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
              placeholder="esempio@email.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Password Input */}
          <View className="mb-4">
            <Text className="text-card-foreground font-medium mb-2">Password</Text>
            <View className="relative">
              <TextInput
                ref={passwordInputRef}
                className="bg-background border border-border rounded-lg px-4 py-3 pr-12 text-foreground"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                className="absolute right-3 top-0 bottom-0 justify-center active:opacity-50"
                onPress={() => setShowPassword(!showPassword)}
              >
                <FontAwesome
                  name={showPassword ? 'eye' : 'eye-slash'}
                  size={20}
                  color="#6b7280"
                />
              </Pressable>
            </View>
          </View>

          {/* Role Selection (signup only) */}
          {mode === 'signup' && (
            <View className="mb-6">
              <Text className="text-card-foreground font-medium mb-3">Ruolo</Text>
              <View className="gap-3">
                {ROLE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    className={`border-2 rounded-lg p-3 ${selectedRole === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-transparent'
                      }`}
                    onPress={() => setSelectedRole(option.value)}
                    disabled={isLoading}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-full bg-[#f3dabb] items-center justify-center">
                        <FontAwesome name={option.icon as any} size={14} color="#8d171e" />
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`font-bold text-base ${selectedRole === option.value
                            ? 'text-primary'
                            : 'text-card-foreground'
                            }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="text-muted-foreground text-xs">
                          {option.description}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Submit Button */}
          <Button
            title={
              isLoading
                ? mode === 'login'
                  ? 'Accesso in corso...'
                  : 'Registrazione in corso...'
                : mode === 'login'
                  ? 'Accedi'
                  : 'Registrati'
            }
            variant="default"
            size="lg"
            onPress={handleSubmit}
            className="w-full"
            disabled={isLoading}
          />

          <Pressable
            className="mt-4 active:opacity-50"
            onPress={() => switchView('otp')}
            disabled={isLoading}
          >
            <Text className="text-muted-foreground text-sm text-center underline">
              Torna all'accesso con codice email
            </Text>
          </Pressable>
        </View>
        )}

        {/* Divider */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-muted-foreground text-sm">oppure</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        {/* Guest Mode Button */}
        <Pressable
          className="bg-muted rounded-xl p-4 border border-border active:opacity-80"
          onPress={handleGuestLogin}
          disabled={isLoading}
        >
          <View className="items-center">
            <View className="flex-row items-center gap-2 mb-1">
              <FontAwesome name="user-o" size={18} color="#4b5563" />
              <Text className="text-foreground font-semibold text-lg">
                Entra come ospite
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm text-center">
              Ordina velocemente senza registrazione (profilo ospite)
            </Text>
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
