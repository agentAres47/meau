import { Text, ActivityIndicator, type PressableProps } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accentCta',
  secondary: 'bg-glassTint border border-glassBorder',
  ghost: 'bg-transparent',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-bg',
  secondary: 'text-text',
  ghost: 'text-accent',
};

// Soft pink glow under the primary CTA — the one place accent gets to bloom.
const ctaGlow = {
  shadowColor: colors.accentCta,
  shadowOpacity: 0.4,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

export function Button({ label, variant = 'primary', loading, disabled, className, ...rest }: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={disabled || loading}
      style={variant === 'primary' && !disabled ? ctaGlow : undefined}
      className={`rounded-pill px-5 py-3.5 items-center justify-center ${VARIANT_CLASSES[variant]} ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bg : colors.text} />
      ) : (
        <Text className={`text-base font-semibold ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
      )}
    </PressableScale>
  );
}
