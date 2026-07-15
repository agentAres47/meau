import { forwardRef, type ElementRef } from 'react';
import { Text } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { colors } from '../theme/tokens';
import { Button } from './Button';
import { PriceSlider } from './PriceSlider';

type Props = {
  offer: number;
  onOfferChange: (value: number) => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
};

// The fare-confirmation drawer: opens when the passenger taps "Find rides"
// on the map-first home screen, shows the offer slider, and only fires the
// actual search on explicit confirm. Auto-sized to its (small, fixed)
// content — no explicit snapPoints needed.
export const FareConfirmSheet = forwardRef<ElementRef<typeof BottomSheetModal>, Props>(
  function FareConfirmSheet({ offer, onOfferChange, onConfirm, loading, error }, ref) {
    return (
      <BottomSheetModal
        ref={ref}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.glassBorder }}
      >
        <BottomSheetView className="px-6 pb-8 pt-2 gap-4">
          <Text className="text-text text-lg font-bold">Confirm your offer</Text>
          <Text className="text-muted text-sm -mt-2">What you'll pay for your part of the trip.</Text>
          <PriceSlider value={offer} onChange={onOfferChange} />
          {error ? <Text className="text-danger text-sm">{error}</Text> : null}
          <Button label="Find rides" loading={loading} onPress={onConfirm} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
