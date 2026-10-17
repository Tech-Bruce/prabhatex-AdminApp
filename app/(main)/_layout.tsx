import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import CustomTabBar from '../../src/components/CustomTabBar';

export default function MainLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props: any) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="package-variant" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={size} color={color} />
          ),
        }}
      />
      
      {/* Hidden Screens from Tab Bar */}
      <Tabs.Screen
        name="banners"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="google-reviews"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="delivery-charges"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="upload-labels"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="product-editor"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="live-view"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
