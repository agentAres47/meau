import { supabase, channelTopic } from './supabase';
import { formatDepart } from './format';

export type ChatMeta = {
  kind: 'ride' | 'autopool';
  other_id: string;
  other_name: string | null;
  other_photo: string | null;
  other_role: 'driver' | 'passenger' | 'pooler' | null;
  origin_label: string | null;
  dest_label: string | null;
  depart_at: string | null;
  price_per_seat: number | null;
};

export type Message = {
  id: string;
  sender_id: string;
  body: string;
  kind: 'text' | 'system' | 'structured';
  created_at: string;
};

export async function getChatMeta(matchId: string): Promise<ChatMeta | null> {
  const { data } = await supabase.rpc('match_chat_meta', { p_match_id: matchId });
  return (data?.[0] as ChatMeta) ?? null;
}

export function matchSummary(meta: ChatMeta): string {
  if (meta.origin_label && meta.dest_label) {
    const when = meta.depart_at ? formatDepart(meta.depart_at) : 'soon';
    const fare = meta.price_per_seat != null ? ` Fare ₹${meta.price_per_seat}/seat.` : '';
    return `You matched for ${meta.origin_label} → ${meta.dest_label} at ${when}.${fare}`;
  }
  return 'You matched! Say hi 👋';
}

export async function getMessages(matchId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('id, sender_id, body, kind, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  return (data as Message[]) ?? [];
}

export async function sendMessage(
  matchId: string,
  senderId: string,
  body: string,
  kind: 'text' | 'structured' = 'text'
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, body, kind });
  if (error) throw new Error(error.message);
}

// Insert the one system summary if it isn't there yet. The partial unique index
// (migration 0007) makes a concurrent double-open a no-op (23505 → ignore).
export async function ensureSystemMessage(matchId: string, senderId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, body, kind: 'system' });
  if (error && error.code !== '23505') throw new Error(error.message);
}

// Realtime: new messages in this match -> callback with the inserted row.
export function subscribeMessages(matchId: string, onInsert: (m: Message) => void): () => void {
  const channel = supabase
    .channel(channelTopic(`messages-${matchId}`))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => onInsert(payload.new as Message)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
