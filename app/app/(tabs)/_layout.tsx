import { Tabs } from 'expo-router';
import { Car, Search, Users } from 'lucide-react-native';
import { colors } from '../../theme/tokens';

// Minimal tab shell so onboarding has a destination. Phase 2 replaces this with
// the custom animated bottom bar (11-UI-DESIGN.md) + profile + become-driver.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surface2,
        },
      }}
    >
      <Tabs.Screen
        name="driver"
        options={{ title: 'Driver', tabBarIcon: ({ color, size }) => <Car color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="passenger"
        options={{ title: 'Passenger', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="autopool"
        options={{ title: 'Auto Pool', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
    </Tabs>
  );
}
