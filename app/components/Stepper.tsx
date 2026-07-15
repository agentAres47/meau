import { View, Text, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { colors } from '../theme/tokens';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

export function Stepper({ value, onChange, min = 1, max = 6 }: Props) {
  return (
    <View className="flex-row items-center bg-surface2 rounded-xl">
      <Pressable
        accessibilityRole="button"
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        className={`p-3 active:scale-[0.97] ${value <= min ? 'opacity-30' : ''}`}
      >
        <Minus color={colors.text} size={18} />
      </Pressable>
      <Text className="text-text text-base font-semibold w-8 text-center">{value}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        className={`p-3 active:scale-[0.97] ${value >= max ? 'opacity-30' : ''}`}
      >
        <Plus color={colors.text} size={18} />
      </Pressable>
    </View>
  );
}
