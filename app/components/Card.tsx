import { type ViewProps } from 'react-native';
import { Glass } from './Glass';

// The standard surface across the app — now a glass panel. Layout props
// (gap, flex-row, padding overrides) still come through className exactly as
// before, so every existing `<Card className="…">` call keeps working.
export function Card({ className, ...rest }: ViewProps) {
  return <Glass className={`p-4 ${className ?? ''}`} {...rest} />;
}
