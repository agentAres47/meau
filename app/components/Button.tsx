import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-surface2 border border-surface2',
  ghost: 'bg-transparent',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-bg',
  secondary: 'text-text',
  ghost: 'text-accent',
};

export function Button({ label, variant = 'primary', loading, disabled, className, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`rounded-xl px-5 py-3.5 items-center justify-center active:scale-[0.97] ${VARIANT_CLASSES[variant]} ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#0E1116' : '#EDF1F5'} />
      ) : (
        <Text className={`text-base font-semibold ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
