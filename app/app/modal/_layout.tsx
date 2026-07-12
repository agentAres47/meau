import { Stack } from 'expo-router';
import { colors } from '../../theme/tokens';

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        presentation: 'modal',
      }}
    />
  );
}
