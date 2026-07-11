import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Sheet } from '../components/Sheet';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { PriceSlider } from '../components/PriceSlider';
import { Stepper } from '../components/Stepper';
import { MapPreview } from '../components/MapPreview';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';

// Dev-only component gallery for Phase 0 smoke testing. Not a real app screen —
// delete once real screens exercise these components in Phase 2+.
export default function Scratch() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [price, setPrice] = useState(80);
  const [seats, setSeats] = useState(3);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="p-4 gap-4">
        <Text className="text-text text-xl font-bold">Component gallery</Text>

        <Card className="gap-3">
          <Button label="Primary" onPress={() => {}} />
          <Button label="Secondary" variant="secondary" onPress={() => {}} />
          <Button label="Ghost" variant="ghost" onPress={() => {}} />
          <Button label="Loading" loading onPress={() => {}} />
          <Button label="Open sheet" onPress={() => setSheetOpen(true)} />
        </Card>

        <Card className="flex-row items-center gap-3">
          <Avatar name="Aditi Rao" />
          <Avatar name="Zed" uri={undefined} size={56} />
          <Badge label="Verified" tone="accent" />
          <Badge label="Live" tone="success" />
          <Badge label="Cancelled" tone="danger" />
        </Card>

        <Card>
          <Input label="Pickup" placeholder="Amity Gate 2" />
        </Card>

        <Card>
          <Text className="text-muted text-sm mb-2">Price per seat</Text>
          <PriceSlider value={price} onChange={setPrice} />
        </Card>

        <Card className="flex-row items-center justify-between">
          <Text className="text-text text-base">Seats</Text>
          <Stepper value={seats} onChange={setSeats} />
        </Card>

        <Card>
          <MapPreview region={{ latitude: 19.1663, longitude: 72.9463 }} />
        </Card>

        <Card>
          <EmptyState title="No rides your way right now" description="Try widening your time window." actionLabel="Try Auto Pool" onAction={() => {}} />
        </Card>

        <Card className="gap-2">
          <Skeleton height={20} width="60%" />
          <Skeleton height={16} />
          <Skeleton height={16} width="80%" />
        </Card>
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text className="text-text text-lg font-semibold mb-2">A sheet</Text>
        <Text className="text-muted">Tap outside or drag the handle to dismiss.</Text>
      </Sheet>
    </SafeAreaView>
  );
}
