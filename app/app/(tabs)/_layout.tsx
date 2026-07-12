import { Tabs } from 'expo-router';
import { colors } from '../../theme/tokens';
import { TabBar } from '../../components/TabBar';

// Order = Driver | Passenger | Auto Pool. Onboarding lands on passenger.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="driver" />
      <Tabs.Screen name="passenger" />
      <Tabs.Screen name="autopool" />
    </Tabs>
  );
}
