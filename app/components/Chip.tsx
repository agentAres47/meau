import { Pressable, Text } from 'react-native';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function Chip({ label, selected, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`rounded-full px-4 py-2 border active:scale-[0.97] ${
        selected ? 'bg-accent border-accent' : 'bg-surface2 border-surface2'
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-bg' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}
