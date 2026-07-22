import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { colors } from '../theme/tokens';

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
};

export function Avatar({ uri, name, size = 40 }: Props) {
  // Fall back to initials if the remote image fails to load (M1) — a broken /
  // stale avatar URL previously rendered an empty circle. Reset on uri change so
  // a reused Avatar instance retries a new url.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Hairline border on BOTH cases: the fallback's bg-surface2 is the exact
  // same fill as the new dark-glass header/dock chrome it now often sits on,
  // so without a defining edge the circle was visually disappearing into its
  // own background (the "profile circle not visible" bug) — a border makes
  // it read against ANY surface, not just ones that happen to contrast.
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.glassBorder,
      }}
      className="bg-surface2 items-center justify-center"
    >
      <Text className="text-text font-semibold" style={{ fontSize: size * 0.4 }}>
        {initials}
      </Text>
    </View>
  );
}
