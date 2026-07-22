import { forwardRef, type ElementRef } from 'react';
import { View, Text } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { colors } from '../theme/tokens';
import { Button } from './Button';
import { Stepper } from './Stepper';

type Props = {
  seats: number;
  onSeatsChange: (value: number) => void;
  maxSeats: number;
  price: number; // auto-computed from route distance — shown, not editable
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
};

// Driver's equivalent of FareConfirmSheet — deliberately seats-only, no price
// slider: price is auto-suggested from the route distance (same suggestedPrice
// used elsewhere), the driver just confirms how many seats are open.
export const SeatsConfirmSheet = forwardRef<ElementRef<typeof BottomSheetModal>, Props>(
  function SeatsConfirmSheet({ seats, onSeatsChange, maxSeats, price, onConfirm, loading, error }, ref) {
    return (
      <BottomSheetModal
        ref={ref}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.glassBorder }}
      >
        <BottomSheetView className="px-6 pb-8 pt-2 gap-4">
          <Text className="text-text text-lg font-bold">How many seats?</Text>

          <View className="flex-row items-center justify-between">
            <Text className="text-muted text-sm">Seats available</Text>
            <Stepper value={seats} onChange={onSeatsChange} min={1} max={maxSeats} />
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-muted text-sm">Suggested price</Text>
            <Text className="text-text text-base font-semibold tabular-nums">₹{price}/seat</Text>
          </View>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          <Button label="Start ride" loading={loading} onPress={onConfirm} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
