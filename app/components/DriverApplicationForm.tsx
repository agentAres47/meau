import { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { Input } from './Input';
import { Button } from './Button';
import { Chip } from './Chip';
import { Stepper } from './Stepper';
import type { VehicleInput } from '../lib/driver';

// Shared licence + vehicle fields, used by both the standalone become-a-driver
// flow and the optional signup step. Caller owns navigation/post-submit behavior.
export function DriverApplicationForm({
  onSubmit,
  submitLabel = 'Submit for review',
  footer,
}: {
  onSubmit: (data: { licenceUri: string; vehicle: VehicleInput }) => Promise<void>;
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const [licenceUri, setLicenceUri] = useState<string | null>(null);
  const [type, setType] = useState<'car' | 'bike'>('car');
  const [makeModel, setMakeModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bikes carry exactly one passenger; cars default to 3 and are adjustable.
  function selectType(t: 'car' | 'bike') {
    setType(t);
    setSeats(t === 'bike' ? 1 : 3);
  }

  async function pickLicence() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Allow photo access to upload your licence.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled) setLicenceUri(res.assets[0].uri);
  }

  async function handleSubmit() {
    setError(null);
    if (!licenceUri) return setError('Upload a photo of your driving licence.');
    if (!makeModel.trim()) return setError('Enter your vehicle make and model.');

    // Indian plate: e.g. MH01AB1234 (state + RTO + series + number), or a BH
    // series like 22BH1234A. Spaces/hyphens are ignored.
    const plateNorm = plate.trim().toUpperCase().replace(/[\s-]/g, '');
    const valid = /^([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/.test(plateNorm);
    if (!valid) return setError('Enter a valid plate number, e.g. MH01AB1234.');

    setLoading(true);
    try {
      await onSubmit({
        licenceUri,
        vehicle: { type, make_model: makeModel.trim(), color: color.trim(), plate_number: plateNorm, seats },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text className="text-sm text-muted">Driving licence</Text>
        <Pressable
          onPress={pickLicence}
          disabled={loading}
          accessibilityRole="button"
          className="rounded-2xl border border-surface2 bg-surface2 overflow-hidden active:opacity-80"
        >
          {licenceUri ? (
            <Image source={{ uri: licenceUri }} style={{ width: '100%', height: 180 }} />
          ) : (
            <View className="h-40 items-center justify-center gap-2">
              <Upload color={colors.muted} size={24} />
              <Text className="text-muted text-sm">Tap to upload a photo</Text>
            </View>
          )}
        </Pressable>
        {licenceUri ? (
          <Text className="text-muted text-xs">Tap the image to choose a different photo.</Text>
        ) : null}
      </View>

      <View className="gap-2">
        <Text className="text-sm text-muted">Vehicle type</Text>
        <View className="flex-row gap-2">
          <Chip label="Car" selected={type === 'car'} onPress={() => selectType('car')} disabled={loading} />
          <Chip label="Bike" selected={type === 'bike'} onPress={() => selectType('bike')} disabled={loading} />
        </View>
      </View>

      <Input label="Make & model" placeholder="e.g. Maruti Swift" value={makeModel} onChangeText={setMakeModel} editable={!loading} />
      <Input label="Colour" placeholder="e.g. White" value={color} onChangeText={setColor} editable={!loading} />
      <Input
        label="Plate number"
        placeholder="e.g. MH01AB1234"
        autoCapitalize="characters"
        value={plate}
        onChangeText={setPlate}
        editable={!loading}
      />

      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-text text-base">Seats for passengers</Text>
          {type === 'bike' ? (
            <Text className="text-muted text-xs mt-0.5">Bikes seat one passenger.</Text>
          ) : null}
        </View>
        <Stepper value={seats} onChange={setSeats} min={1} max={type === 'bike' ? 1 : 6} />
      </View>

      {error ? <Text className="text-danger text-sm">{error}</Text> : null}

      <Button label={submitLabel} loading={loading} onPress={handleSubmit} />
      {footer}
    </View>
  );
}
