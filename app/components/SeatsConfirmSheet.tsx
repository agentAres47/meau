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
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
};

// Driver's equivalent of FareConfirmSheet — deliberately seats-only, no price
// slider: price is auto-suggested from the route distance (same suggestedPrice
// used elsewhere), the driver just confirms how many seats are open.
export const SeatsConfirmSheet = forwardRef<ElementRef<typeof BottomSheetModal>, Props>(
  function SeatsConfirmSheet({ seats, onSeatsChange, maxSeats, onConfirm, loading, error }, ref) {
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

          {/* Suggested-price row hidden until the pricing algorithm is reworked
              (#7). The token is still posted with its computed price (from
              driver.tsx); riders coordinate the fare in chat for now. */}

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          <Button label="Start ride" loading={loading} onPress={onConfirm} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
