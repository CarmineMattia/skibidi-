/**
 * Login Screen
 * Authentication with role selection
 */

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/stores/AuthContext';
import type { UserRole } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

type AuthMode = 'login' | 'signup';

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: string }[] = [
  {
    value: 'admin',
    label: 'Admin / Cassa',
    description: 'Accesso completo a tutte le funzionalità',
    icon: '👨‍💼',
  },
  {
    value: 'customer',
    label: 'Cliente',
    description: 'Visualizza menu e ordini personali',
    icon: '👤',
  },
];

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const { signIn, signUp, enterKioskMode } = useAuth();
  const router = useRouter();

  const handleSubmit = async () => {
    setErrorMessage(null);

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
        await signUp(email.trim(), password, fullName.trim(), selectedRole);
        Alert.alert(
          'Registrazione completata',
          'Controlla la tua email per confermare l\'account',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
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

  const handleKioskMode = () => {
    enterKioskMode();
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
          <Text className="text-6xl mb-3">🍟</Text>
          <Text className="text-foreground font-bold text-4xl mb-2">
            SKIBIDI ORDERS
          </Text>
          <Text className="text-muted-foreground text-lg">
            Sistema POS per Ristorazione
          </Text>
        </View>

        {/* Mode Toggle */}
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

        {/* Login/Signup Form */}
        <View className="bg-card rounded-2xl p-6 border border-border shadow-lg mb-6">
          <Text className="text-card-foreground font-semibold text-xl mb-6">
            {mode === 'login' ? 'Accedi' : 'Crea Account'}
          </Text>

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
                      <Text className="text-2xl">{option.icon}</Text>
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
        </View>

        {/* Divider */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-muted-foreground text-sm">oppure</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        {/* Kiosk Mode Button */}
        <Pressable
          className="bg-muted rounded-xl p-4 border border-border active:opacity-80"
          onPress={handleKioskMode}
          disabled={isLoading}
        >
          <View className="items-center">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-2xl">🖥️</Text>
              <Text className="text-foreground font-semibold text-lg">
                Modalità Kiosk
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm text-center">
              Ordini anonimi senza login
            </Text>
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
