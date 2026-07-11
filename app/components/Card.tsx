import { View, type ViewProps } from 'react-native';

export function Card({ className, ...rest }: ViewProps) {
  return (
    <View
      className={`bg-surface rounded-2xl p-4 border border-surface2 ${className ?? ''}`}
      {...rest}
    />
  );
}
