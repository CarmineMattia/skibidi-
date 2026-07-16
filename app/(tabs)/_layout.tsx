import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/stores/AuthContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  readonly name: React.ComponentProps<typeof FontAwesome>['name'];
  readonly color: string;
  readonly size?: number;
}) {
  const { size = 28, ...rest } = props;
  return <FontAwesome size={size} style={{ marginBottom: -3 }} {...rest} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { userRole } = useAuth();
  const { width } = useWindowDimensions();
  const viewportWidth = Dimensions.get('window').width;
  const effectiveWidth = Math.min(width, viewportWidth);
  const compactTabBar = effectiveWidth < 400;
  const tabIconSize = compactTabBar ? 22 : 28;
  const isWebDesktop = Platform.OS === 'web' && effectiveWidth >= 768;
  const palette = Colors[colorScheme ?? 'light'];
  const tabBarStyle = {
    backgroundColor: '#fff9f1',
    borderTopColor: 'rgba(141, 23, 30, 0.12)',
    borderTopWidth: 1,
    height: compactTabBar ? 56 : 64,
    paddingBottom: compactTabBar ? 4 : 8,
    paddingTop: 4,
  } as const;
  const hiddenTabBarStyle = { display: 'none' } as const;

  // Role-based tab visibility
  // Kiosk/Guest/Customer: Home + Menu + Account
  // Admin: Home + Dashboard + Menu + Kitchen + Orders + Account
  const showHome = true;
  const showAdminDashboard = userRole === 'admin';
  const showKitchen = userRole === 'admin';
  const showOrders = userRole === 'admin' || userRole === 'customer';
  const showAccount = true;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarLabelStyle: { fontSize: compactTabBar ? 10 : 12, fontWeight: '600' },
        tabBarItemStyle: compactTabBar ? { paddingVertical: 4 } : undefined,
        tabBarStyle,
        // App-like look also on web: no top browser-like header.
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} size={tabIconSize} />,
          href: showHome ? '/(tabs)' : null,
          // Desktop landing uses its own header navigation.
          tabBarStyle: isWebDesktop ? hiddenTabBarStyle : tabBarStyle,
        }}
      />
      <Tabs.Screen
        name="admin-dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="line-chart" color={color} size={tabIconSize} />,
          href: showAdminDashboard ? '/(tabs)/admin-dashboard' : null,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-cart" color={color} size={tabIconSize} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: 'Cucina',
          tabBarIcon: ({ color }) => <TabBarIcon name="cutlery" color={color} size={tabIconSize} />,
          headerShown: false,
          href: showKitchen ? '/(tabs)/kitchen' : null,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} size={tabIconSize} />,
          href: showOrders ? '/(tabs)/two' : null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} size={tabIconSize} />,
          href: showAccount ? '/(tabs)/account' : null,
        }}
      />
      <Tabs.Screen
        name="order-tracking"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
