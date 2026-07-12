import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Upload } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Stepper } from '../../components/Stepper';
import { useSession } from '../../store/session';
import { submitDriverApplication } from '../../lib/driver';

export default function BecomeDriver() {
  const profile = useSession((s) => s.profile);

  const [licenceUri, setLicenceUri] = useState<string | null>(null);
  const [type, setType] = useState<'car' | 'bike'>('car');
  const [makeModel, setMakeModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

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

  async function onSubmit() {
    setError(null);
    if (!licenceUri) return setError('Upload a photo of your driving licence.');
    if (!makeModel.trim()) return setError('Enter your vehicle make and model.');
    if (!plate.trim()) return setError('Enter your vehicle plate number.');

    setLoading(true);
    try {
      await submitDriverApplication({
        profileId: profile!.id,
        authUserId: profile!.auth_user_id,
        licenceUri,
        vehicle: {
          type,
          make_model: makeModel.trim(),
          color: color.trim(),
          plate_number: plate.trim().toUpperCase(),
          seats,
        },
      });
      router.back(); // Profile shows the pending state on focus
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
        >
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <Text className="text-text text-base font-semibold">Become a driver</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="px-6 pt-4 pb-4 gap-6" keyboardShouldPersistTaps="handled">
          <Text className="text-muted text-sm">
            Upload your driving licence and vehicle details. We review it before you can post rides.
          </Text>

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
              <Chip label="Car" selected={type === 'car'} onPress={() => setType('car')} disabled={loading} />
              <Chip label="Bike" selected={type === 'bike'} onPress={() => setType('bike')} disabled={loading} />
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
            <Text className="text-text text-base">Seats for passengers</Text>
            <Stepper value={seats} onChange={setSeats} min={1} max={6} />
          </View>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}
        </ScrollView>

        <View className="px-6 pb-4">
          <Button label="Submit for review" loading={loading} onPress={onSubmit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
