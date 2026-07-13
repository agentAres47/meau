import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, ShieldCheck, Users } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Avatar } from '../../components/Avatar';
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
import { getAutopoolChatMeta, autopoolSummary, type AutopoolChatMeta } from '../../lib/autopool';

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
  const listRef = useRef<FlatList<Message>>(null);

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

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

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
      <SafeAreaView className="flex-1 bg-bg items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-surface2">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" className="active:opacity-70 -ml-1">
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

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          renderItem={({ item }) => <Bubble message={item} mine={item.sender_id === me?.id} />}
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

        {/* Composer */}
        <View className="flex-row items-end gap-2 px-4 pt-1 pb-3">
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
    </SafeAreaView>
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
