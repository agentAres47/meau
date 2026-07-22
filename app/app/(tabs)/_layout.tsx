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
        // Driver + Passenger each run a full-screen native react-native-maps
        // MapView. React Navigation tabs keep inactive screens mounted AND
        // actively rendering by default -- so without this, switching tabs left
        // TWO live native maps rendering simultaneously (a serious, well-known
        // RN perf hit: GPU/memory pressure even off-screen). freezeOnBlur (via
        // react-native-screens) stops the inactive screen from rendering/
        // updating without unmounting it, so local state (sheet position, etc.)
        // survives a tab switch too.
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen name="driver" />
      <Tabs.Screen name="passenger" />
      <Tabs.Screen name="autopool" />
    </Tabs>
  );
}
