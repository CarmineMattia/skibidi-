/**
 * Supabase Connection Test Component
 * Use this to verify your Supabase setup is working
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { supabase } from '@/lib/api/supabase';

interface ConnectionStatus {
  connected: boolean;
  message: string;
  details?: string;
}

export function SupabaseConnectionTest(): React.JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    message: 'Testing connection...',
  });
  const [loading, setLoading] = useState(true);

  const testConnection = async (): Promise<void> => {
    setLoading(true);
    setStatus({ connected: false, message: 'Testing connection...' });

    try {
      // Test 1: Check if Supabase client is configured
      if (!supabase) {
        setStatus({
          connected: false,
          message: 'Error: Supabase client not initialized',
        });
        setLoading(false);
        return;
      }

      // Test 2: Try to fetch categories (should work even without data)
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .limit(5);

      if (error) {
        setStatus({
          connected: false,
          message: 'Connection failed',
          details: error.message,
        });
      } else {
        setStatus({
          connected: true,
          message: 'Connection successful!',
          details: `Found ${data?.length || 0} categories`,
        });
      }
    } catch (error) {
      setStatus({
        connected: false,
        message: 'Connection error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <View className="p-4 bg-card rounded-lg border border-border">
      <Text className="text-lg font-semibold text-card-foreground mb-2">
        Supabase Connection Test
      </Text>

      {loading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-muted-foreground">Testing...</Text>
        </View>
      ) : (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl">
              {status.connected ? '✅' : '❌'}
            </Text>
            <Text
              className={
                status.connected
                  ? 'text-green-600 font-medium'
                  : 'text-red-600 font-medium'
              }
            >
              {status.message}
            </Text>
          </View>

          {status.details && (
            <Text className="text-sm text-muted-foreground">
              {status.details}
            </Text>
          )}

          <Pressable
            className="mt-4 bg-primary p-3 rounded-lg active:opacity-80"
            onPress={testConnection}
          >
            <Text className="text-primary-foreground text-center font-semibold">
              Test Again
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
