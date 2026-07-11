import { View, Text } from 'react-native';

type Tone = 'accent' | 'success' | 'danger' | 'muted';

type Props = {
  label: string;
  tone?: Tone;
};

const BG_CLASSES: Record<Tone, string> = {
  accent: 'bg-accentSoft',
  success: 'bg-success/15',
  danger: 'bg-danger/15',
  muted: 'bg-surface2',
};

const TEXT_CLASSES: Record<Tone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-muted',
};

export function Badge({ label, tone = 'muted' }: Props) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${BG_CLASSES[tone]}`}>
      <Text className={`text-xs font-medium ${TEXT_CLASSES[tone]}`}>{label}</Text>
    </View>
  );
}
