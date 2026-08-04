import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ChevronLeft, Send, ShieldCheck, Users } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { formatDepart } from '../../lib/format';
import { setActiveMatch, ensureNotificationPermission, clearNotifications } from '../../lib/notifications';
import { endRide, subscribeMatch, getMatchCompletedAt } from '../../lib/match';
import { matchHaptic } from '../../lib/haptics';
import { Avatar } from '../../components/Avatar';
import { Skeleton } from '../../components/Skeleton';
import { useSession } from '../../store/session';
import {
  getChatMeta,
  getMessages,
  sendMessage,
  ensureSystemMessage,
  subscribeMessages,
  matchSummary,
  type ChatMeta,
  type Message,
} from '../../lib/chat';
import {
  getAutopoolChatMeta,
  autopoolSummary,
  leavePool,
  subscribeMatchStatus,
  type AutopoolChatMeta,
} from '../../lib/autopool';

const QUICK_PROMPTS = [
  'What time exactly?',
  'Which gate / pickup point?',
  'On my way',
  'Reached',
];

export default function MatchChat() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const me = useSession((s) => s.profile);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [autopool, setAutopool] = useState<AutopoolChatMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endBusy, setEndBusy] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();
  const ratedRef = useRef(false);
  // Drives dropping the bottom safe-area inset while the keyboard is up, so the
  // composer sits flush against the keys (WhatsApp-style) instead of floating
  // above them.
  const keyboardVisible = useKeyboardState((s) => s.isVisible);

  // #7: the messaging screen is the ONLY place we suppress this match's pushes
  // (the ride/matched screen now lets them through). Opening the chat also
  // clears any already-delivered notifications from the tray.
  useFocusEffect(
    useCallback(() => {
      if (matchId) {
        setActiveMatch(matchId);
        clearNotifications();
      }
      return () => setActiveMatch(null);
    }, [matchId])
  );

  // H1: autopool users reach a match here (not the directed-ride matched
  // screen), so this is also a contextual moment to ask for push permission.
  useEffect(() => {
    if (me?.id) ensureNotificationPermission(me.id);
  }, [me?.id]);

  // Load meta + history, seed the system summary, THEN subscribe — subscribing
  // before history is set would let an incoming message get clobbered by the
  // setMessages(history) that lands after it.
  useEffect(() => {
    if (!matchId || !me) return;
    let alive = true;
    let unsub = () => {};
    (async () => {
      try {
        const m = await getChatMeta(matchId);
        if (!alive) return;
        setMeta(m);
        if (m?.kind === 'autopool') {
          const a = await getAutopoolChatMeta(matchId, me.id);
          if (!alive) return;
          setAutopool(a);
          if (a) await ensureSystemMessage(matchId, me.id, autopoolSummary(a));
        } else if (m) {
          await ensureSystemMessage(matchId, me.id, matchSummary(m));
        }
        const history = await getMessages(matchId);
        if (!alive) return;
        setMessages(history);
        unsub = subscribeMessages(matchId, (msg) => {
          // Realtime re-delivers our own inserts too — de-dupe by id.
          setMessages((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]));
        });
      } catch {
        if (alive) setError("Couldn't open this chat.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      unsub();
    };
  }, [matchId, me]);

  // Autopool only: if the OTHER participant leaves (disbanding the pool),
  // this side gets kicked back to the Auto Pool tab too -- their own session
  // is already back to 'waiting' server-side, so they resume searching
  // immediately with no re-picking.
  useEffect(() => {
    if (!matchId || meta?.kind !== 'autopool') return;
    return subscribeMatchStatus(matchId, (status) => {
      if (status === 'disbanded') router.dismissTo('/(tabs)/autopool');
    });
  }, [matchId, meta?.kind]);

  // F8 (autopool): directed rides end from ride/matched/[matchId] — that
  // screen doesn't exist for autopool (which lands here directly), so "End
  // ride" lives in this header instead. Realtime + a plain select (no new RPC,
  // matches_participant_select already permits it) catch the OTHER poolers.
  // (Ratings were removed — ending just leaves to the Auto Pool tab.)
  useEffect(() => {
    if (!matchId || meta?.kind !== 'autopool') return;
    return subscribeMatch(matchId, async () => {
      if (ratedRef.current) return;
      const completedAt = await getMatchCompletedAt(matchId);
      if (completedAt) {
        ratedRef.current = true;
        router.dismissTo('/(tabs)/autopool');
      }
    });
  }, [matchId, meta?.kind]);

  async function onEndRide() {
    if (!matchId) return;
    setEndBusy(true);
    try {
      await endRide(matchId);
      matchHaptic();
      ratedRef.current = true;
      router.dismissTo('/(tabs)/autopool');
    } catch {
      setError('Could not end the ride. Try again.');
      setEndBusy(false);
    }
  }

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  function onBack() {
    if (meta?.kind !== 'autopool') {
      router.back();
      return;
    }
    Alert.alert('Leave this pool?', 'Everyone else in this pool will start searching again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          if (!matchId) return;
          try {
            await leavePool(matchId);
          } finally {
            router.dismissTo('/(tabs)/autopool');
          }
        },
      },
    ]);
  }

  async function send(body: string, kind: 'text' | 'structured' = 'text') {
    const trimmed = body.trim();
    if (!trimmed || !matchId || !me) return;
    setText('');
    try {
      await sendMessage(matchId, me.id, trimmed, kind);
    } catch {
      setError("Message didn't send. Try again.");
    }
  }

  if (loading) {
    return (
      <Screen edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 py-3 border-b border-surface2">
          <Skeleton width={26} height={26} radius={13} />
          <Skeleton width={40} height={40} radius={20} />
          <View className="flex-1 gap-2">
            <Skeleton width="50%" height={14} />
            <Skeleton width="30%" height={10} />
          </View>
        </View>
        <View className="px-4 pt-4 gap-3">
          <Skeleton width="55%" height={36} radius={18} style={{ alignSelf: 'flex-start' }} />
          <Skeleton width="40%" height={36} radius={18} style={{ alignSelf: 'flex-end' }} />
          <Skeleton width="60%" height={36} radius={18} style={{ alignSelf: 'flex-start' }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-surface2">
        <Pressable onPress={onBack} accessibilityLabel="Back" className="active:opacity-70 -ml-1">
          <ChevronLeft color={colors.text} size={26} />
        </Pressable>
        {meta?.kind === 'autopool' ? (
          <>
            <View className="w-10 h-10 rounded-full bg-surface2 items-center justify-center">
              <Users color={colors.accent} size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-text text-base font-semibold" numberOfLines={1}>
                {autopool?.routeLabel ?? 'Auto Pool'}
              </Text>
              <Text className="text-muted text-xs">
                {autopool ? `${autopool.poolSize} pooling` : 'Auto Pool'}
              </Text>
            </View>
            <Pressable
              onPress={onEndRide}
              disabled={endBusy}
              accessibilityRole="button"
              className="active:opacity-70 px-2"
            >
              <Text className="text-accent text-xs font-semibold">
                {endBusy ? '…' : 'End ride'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Avatar name={meta?.other_name || 'Rider'} uri={meta?.other_photo} size={40} />
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-text text-base font-semibold" numberOfLines={1}>
                  {meta?.other_name || (meta?.other_role === 'driver' ? 'Your driver' : 'Your rider')}
                </Text>
                <ShieldCheck color={colors.success} size={14} />
              </View>
              <Text className="text-muted text-xs capitalize">{meta?.other_role ?? 'Amity member'}</Text>
            </View>
          </>
        )}
      </View>

      {/* react-native-keyboard-controller's KeyboardAvoidingView — reliable on
          Android edge-to-edge (RN's core one is not).
          NO keyboardVerticalOffset on purpose. Unlike RN's version, this one
          measures the view's absolute frame itself:
            padding = frame.bottom - (screenHeight - keyboardHeight - offset)
          so any offset is added straight on top of the correct value. Passing
          insets.top + headerH here (~250px) pushed the composer that far ABOVE
          the keyboard — the visible gap. It belongs at 0. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          className="flex-1"
          contentContainerClassName="px-4 py-4 gap-2"
          onContentSizeChange={scrollToEnd}
          ListHeaderComponent={
            <View className="flex-row items-center gap-2 bg-surface2 rounded-xl px-3 py-2 mb-2">
              <ShieldCheck color={colors.success} size={16} />
              <Text className="text-muted text-xs flex-1">
                Keep it respectful — you're both verified Amity members.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === 'system') {
              // Compact structured "Ride Matched" card for directed rides (uses
              // the meta the screen already has); plain text otherwise.
              if (meta?.kind === 'ride' && meta.origin_label && meta.dest_label) {
                return <RideMatchedCard meta={meta} />;
              }
              return <Text className="text-muted text-xs text-center px-6 py-1">{item.body}</Text>;
            }
            return <Bubble message={item} mine={item.sender_id === me?.id} />;
          }}
        />

        {error ? <Text className="text-danger text-sm px-4 pb-1">{error}</Text> : null}

        {/* Quick-reply chips */}
        <ScrollView
          horizontal
          className="max-h-12 flex-none"
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 gap-2 pb-2 items-center"
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_PROMPTS.map((q) => (
            <Pressable
              key={q}
              onPress={() => send(q, 'structured')}
              className="rounded-full px-3.5 py-2 bg-surface2 border border-surface2 active:scale-[0.97] items-center justify-center"
            >
              <Text className="text-text text-sm">{q}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Composer — reserves the bottom safe-area inset so it never sits under
            the gesture nav bar. That inset is dropped while the keyboard is up:
            the keyboard already covers the nav bar, so keeping it would leave a
            dead strip between the input and the keys instead of the input
            sitting flush against them. */}
        <View
          className="flex-row items-end gap-2 px-4 pt-1"
          style={{ paddingBottom: (keyboardVisible ? 0 : insets.bottom) + 8 }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={colors.muted}
            multiline
            className="flex-1 max-h-28 bg-surface2 text-text rounded-2xl px-4 py-3 text-base"
          />
          <Pressable
            onPress={() => send(text)}
            disabled={!text.trim()}
            accessibilityLabel="Send"
            className={`w-11 h-11 rounded-full items-center justify-center ${
              text.trim() ? 'bg-accent' : 'bg-surface2'
            }`}
          >
            <Send color={text.trim() ? colors.bg : colors.muted} size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Compact structured card replacing the long "you matched…" paragraph.
function RideMatchedCard({ meta }: { meta: ChatMeta }) {
  return (
    <View className="self-stretch bg-surface2 rounded-2xl px-4 py-3 my-1 gap-2">
      <Text className="text-text text-sm font-semibold">Ride Matched</Text>
      <Row label="From" value={meta.origin_label} />
      <Row label="To" value={meta.dest_label} />
      {meta.depart_at ? <Row label="Departure" value={formatDepart(meta.depart_at)} /> : null}
      {meta.price_per_seat != null ? <Row label="Fare" value={`₹${meta.price_per_seat}/seat`} /> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-muted text-xs">{label}</Text>
      <Text className="text-text text-xs font-medium flex-1 text-right" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  if (message.kind === 'system') {
    return (
      <Text className="text-muted text-xs text-center px-6 py-1">{message.body}</Text>
    );
  }
  return (
    <View
      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
        mine ? 'self-end bg-accent' : 'self-start bg-surface2'
      }`}
    >
      <Text className={`text-base ${mine ? 'text-bg' : 'text-text'}`}>{message.body}</Text>
    </View>
  );
}
