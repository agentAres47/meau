import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';

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
        minimumTrackTintColor="#6C7BFF"
        maximumTrackTintColor="#1F2630"
        thumbTintColor="#6C7BFF"
      />
      <View className="flex-row justify-between">
        <Text className="text-muted text-xs">₹{min}</Text>
        <Text className="text-muted text-xs">₹{max}</Text>
      </View>
    </View>
  );
}
