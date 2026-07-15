import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';
import { Button } from './Button';
import { colors } from '../theme/tokens';

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }: Props) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <View className="bg-surface2 rounded-full p-4 mb-4">
        <Icon color={colors.muted} size={28} />
      </View>
      <Text className="text-text text-lg font-semibold text-center">{title}</Text>
      {description ? (
        <Text className="text-muted text-sm text-center mt-1.5">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} className="mt-5" />
      ) : null}
    </View>
  );
}
