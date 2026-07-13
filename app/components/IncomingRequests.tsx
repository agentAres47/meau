import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../theme/tokens';
import { ArrowRight } from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';
import { Avatar } from './Avatar';
import {
  getIncoming,
  subscribeDriverTargets,
  acceptRequest,
  declineTarget,
  type Incoming,
} from '../lib/requests';

// Live list of pending ride requests aimed at this driver's token. Accept is
// atomic (race winner); losing requests vanish via realtime (target dismissed).
export function IncomingRequests({ driverId, onMatched }: { driverId: string; onMatched: () => void }) {
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    getIncoming(driverId).then(setIncoming);
  }, [driverId]);

  useEffect(() => {
    load();
    return subscribeDriverTargets(driverId, load);
  }, [driverId, load]);

  async function accept(i: Incoming) {
    setBusy(i.target_id);
    setNote(null);
    try {
      const matchId = await acceptRequest({ requestId: i.request_id, tokenId: i.token_id, driverId });
      onMatched();
      router.push(`/match/${matchId}`);
    } catch {
      setNote('That request was already taken.');
    } finally {
      setBusy(null);
      load();
    }
  }

  async function decline(i: Incoming) {
    setBusy(i.target_id);
    await declineTarget(i.target_id);
    setBusy(null);
    load();
  }

  if (incoming.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="text-text text-base font-semibold">Incoming requests</Text>
      {note ? <Text className="text-danger text-sm">{note}</Text> : null}
      {incoming.map((i) => (
        <Card key={i.target_id} className="gap-3">
          <View className="flex-row items-center gap-3">
            <Avatar name={i.passenger_name || 'Passenger'} uri={i.passenger_photo} size={40} />
            <Text className="text-text text-base font-semibold flex-1" numberOfLines={1}>
              {i.passenger_name || 'Passenger'}
            </Text>
            <Text className="text-text text-base font-bold tabular-nums">₹{i.offered_price}</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Text className="text-text text-sm flex-1" numberOfLines={1}>
              {i.pickup_label}
            </Text>
            <ArrowRight color={colors.muted} size={14} />
            <Text className="text-text text-sm flex-1 text-right" numberOfLines={1}>
              {i.drop_label}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Decline" variant="secondary" onPress={() => decline(i)} disabled={busy === i.target_id} />
            </View>
            <View className="flex-1">
              <Button label="Accept" loading={busy === i.target_id} onPress={() => accept(i)} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
