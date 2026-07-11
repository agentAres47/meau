import { useState } from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? <Text className="text-sm text-muted mb-1.5">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#8A94A3"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`bg-surface2 text-text rounded-xl px-4 py-3.5 text-base border ${
          error ? 'border-danger' : focused ? 'border-accent' : 'border-surface2'
        } ${className ?? ''}`}
        {...rest}
      />
      {error ? <Text className="text-sm text-danger mt-1">{error}</Text> : null}
    </View>
  );
}
