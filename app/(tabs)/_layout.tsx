import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/stores/AuthContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { userRole, isKioskMode } = useAuth();

  console.log('TabLayout Render:', { userRole, isKioskMode });

  // Role-based tab visibility
  // Kiosk: Only menu
  // Customer: Menu + Orders (two)
  // Admin: All tabs (Menu, Dashboard, Kitchen, Orders)
  const showDashboard = userRole === 'admin';
  const showKitchen = userRole === 'admin';
  const showOrders = userRole === 'admin' || userRole === 'customer';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-cart" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
          href: showDashboard ? '/(tabs)' : null,
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: 'Cucina',
          tabBarIcon: ({ color }) => <TabBarIcon name="cutlery" color={color} />,
          headerShown: false,
          href: showKitchen ? '/(tabs)/kitchen' : null,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Ordini',
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
          href: showOrders ? '/(tabs)/two' : null,
        }}
      />
    </Tabs>
  );
}
