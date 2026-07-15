import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '../theme/tokens';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function PriceSlider({ value, onChange, min = 20, max = 300, step = 5 }: Props) {
  return (
    <View>
      <Text className="text-text text-xxl font-bold tabular-nums">₹{value}</Text>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.surface2}
        thumbTintColor={colors.accent}
      />
      <View className="flex-row justify-between">
        <Text className="text-muted text-xs">₹{min}</Text>
        <Text className="text-muted text-xs">₹{max}</Text>
      </View>
    </View>
  );
}
