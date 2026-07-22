import { forwardRef, useMemo, useState, type ElementRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { colors } from '../theme/tokens';
import { Chip } from './Chip';
import { selectionHaptic } from '../lib/haptics';

// On-brand replacement for the stock Android date/time dialog (Phase A). A dark
// glass bottom sheet: Today/Tomorrow chips + a scrollable list of 15-min slots.
// JS-only (no native picker), consistent with FareConfirmSheet's pattern.
type Props = {
  onConfirm: (d: Date) => void;
};

function timeLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// 15-min slots for `dayOffset` days from today. Today starts at the next future
// 15-min boundary; other days start at 05:00. Ends at 23:45.
function slotsFor(dayOffset: number): Date[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  if (dayOffset === 0) {
    start.setTime(now.getTime());
    start.setSeconds(0, 0);
    const m = start.getMinutes();
    start.setMinutes(m + ((15 - (m % 15)) % 15 || 15));
  } else {
    start.setHours(5, 0, 0, 0);
  }
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 23, 45, 0, 0);
  const out: Date[] = [];
  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 15 * 60_000)) {
    out.push(new Date(t));
  }
  return out;
}

export const TimePickerSheet = forwardRef<ElementRef<typeof BottomSheetModal>, Props>(
  function TimePickerSheet({ onConfirm }, ref) {
    const [day, setDay] = useState(0);
    const slots = useMemo(() => slotsFor(day), [day]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['55%']}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.glassBorder }}
      >
        <View className="px-6 pt-2 pb-3 gap-3">
          <Text className="text-text text-lg font-bold">When?</Text>
          <View className="flex-row gap-2">
            <Chip label="Today" selected={day === 0} onPress={() => setDay(0)} />
            <Chip label="Tomorrow" selected={day === 1} onPress={() => setDay(1)} />
          </View>
        </View>
        <BottomSheetFlatList
          data={slots}
          keyExtractor={(d) => d.toISOString()}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                selectionHaptic();
                onConfirm(item);
              }}
              className="py-3.5 border-b border-surface2 active:opacity-60"
              accessibilityRole="button"
            >
              <Text className="text-text text-base">{timeLabel(item)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text className="text-muted text-sm py-6 text-center">
              No more times today — try Tomorrow.
            </Text>
          }
        />
      </BottomSheetModal>
    );
  }
);
