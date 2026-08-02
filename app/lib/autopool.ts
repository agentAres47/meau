import { supabase, channelTopic } from './supabase';
import { logDbError } from './dbError';
import { formatDepart } from './format';

export type RouteCode = 'AMITY_STATION' | 'STATION_AMITY' | 'AMITY_IB' | 'IB_AMITY';

// Config array (specs/07-AUTO-POOL.md) — add more routes here as needed.
export const PRESET_ROUTES: { code: RouteCode; label: string; typicalFare: number }[] = [
  { code: 'AMITY_STATION', label: 'Amity → Station', typicalFare: 230 },
  { code: 'STATION_AMITY', label: 'Station → Amity', typicalFare: 230 },
  { code: 'AMITY_IB', label: 'Amity → IB', typicalFare: 150 },
  { code: 'IB_AMITY', label: 'IB → Amity', typicalFare: 150 },
];

export type PoolMode = 'now' | 'scheduled';

export type PoolSession = {
  id: string;
  route_code: RouteCode;
  mode: PoolMode;
  slot_time: string | null;
  status: 'waiting' | 'matched' | 'cancelled' | 'expired';
  pool_group_id: string | null;
};

// Next few 30-minute slots, starting from the next upcoming one.
export function nextSlots(count = 6): Date[] {
  const slots: Date[] = [];
  const t = new Date();
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0);
  for (let i = 0; i < count; i++) {
    slots.push(new Date(t.getTime() + i * 30 * 60_000));
  }
  return slots;
}

export async function createPoolSession(params: {
  profileId: string;
  routeCode: RouteCode;
  mode: PoolMode;
  slotTime?: Date;
}): Promise<string> {
  const { data, error } = await supabase
    .from('auto_pool_sessions')
    .insert({
      profile_id: params.profileId,
      route_code: params.routeCode,
      mode: params.mode,
      slot_time: params.slotTime ? params.slotTime.toISOString() : null,
      status: 'waiting',
    })
    .select('id')
    .single();
  if (error) throw new Error('Could not start auto pool search. Try again.');
  return data.id as string;
}

export async function getActivePoolSession(profileId: string): Promise<PoolSession | null> {
  const { data, error } = await supabase
    .from('auto_pool_sessions')
    .select('id, route_code, mode, slot_time, status, pool_group_id')
    .eq('profile_id', profileId)
    .in('status', ['waiting', 'matched'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  logDbError('getActivePoolSession', error);
  return (data as PoolSession) ?? null;
}

export async function cancelPoolSession(sessionId: string): Promise<void> {
  await supabase.from('auto_pool_sessions').update({ status: 'cancelled' }).eq('id', sessionId);
}

// Realtime on the passenger's own session row -> callback on any change.
export function subscribePoolSession(sessionId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(channelTopic(`pool-${sessionId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'auto_pool_sessions', filter: `id=eq.${sessionId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Disbands the pool: the caller's own session is cancelled, everyone else's
// goes straight back to 'waiting' (same route/mode/slot, no re-picking) so
// they resume searching immediately.
export async function leavePool(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_autopool', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

// Realtime on the matches row -> callback with the new status ('disbanded'
// when either side leaves). Used by the autopool chat screen so the
// participant who DIDN'T leave gets kicked back to searching live.
export function subscribeMatchStatus(matchId: string, onChange: (status: string) => void): () => void {
  const channel = supabase
    .channel(channelTopic(`match-status-${matchId}`))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      (payload) => onChange((payload.new as { status: string }).status)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getPoolMatchId(poolGroupId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('pool_group_id', poolGroupId)
    .maybeSingle();
  logDbError('getPoolMatchId', error);
  return (data?.id as string) ?? null;
}

// #2 — cold-start restore. If the user has a live pool session, return the href
// that drops them back into it instead of the default home tab: the pooled-match
// chat when matched, otherwise the Auto Pool tab (which restores the Waiting
// state). null = nothing to restore -> caller falls back to home.
export async function resumeHref(profileId: string): Promise<string | null> {
  const s = await getActivePoolSession(profileId);
  if (!s) return null;
  if (s.status === 'matched' && s.pool_group_id) {
    const matchId = await getPoolMatchId(s.pool_group_id);
    if (!matchId) return '/(tabs)/autopool';
    // Don't restore a ride that's already finished — otherwise a completed pool
    // relaunches into its chat, which immediately routes to the rate screen,
    // trapping the user there on every restart (#12). Fail CLOSED on any query
    // hiccup (don't restore) rather than open (restore anyway) — the real fix
    // for the sticky-notification version of #12 is in notifications.ts, but a
    // silent error here shouldn't independently reintroduce the same trap.
    const { data, error } = await supabase.from('matches').select('completed_at').eq('id', matchId).maybeSingle();
    if (error) return null;
    if ((data as { completed_at: string | null } | null)?.completed_at) return null;
    return `/match/${matchId}`;
  }
  return '/(tabs)/autopool'; // 'waiting'
}

export type AutopoolChatMeta = {
  routeLabel: string;
  slotTime: string | null;
  poolSize: number;
  splitFare: number;
};

// Everything the chat screen needs for an autopool match's header + system
// message. Every step here is readable under existing RLS as a plain
// participant query (own auto_pool_sessions row + sibling match_participants
// rows) — no new RPC/security-definer needed.
export async function getAutopoolChatMeta(matchId: string, myProfileId: string): Promise<AutopoolChatMeta | null> {
  const { data: match } = await supabase.from('matches').select('pool_group_id').eq('id', matchId).maybeSingle();
  if (!match?.pool_group_id) return null;

  const { data: session } = await supabase
    .from('auto_pool_sessions')
    .select('route_code, slot_time')
    .eq('pool_group_id', match.pool_group_id)
    .eq('profile_id', myProfileId)
    .maybeSingle();
  if (!session) return null;

  const { count } = await supabase
    .from('match_participants')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId);
  const poolSize = count ?? 2;

  const route = PRESET_ROUTES.find((r) => r.code === session.route_code);
  return {
    routeLabel: route?.label ?? session.route_code,
    slotTime: session.slot_time,
    poolSize,
    splitFare: Math.round((route?.typicalFare ?? 230) / poolSize),
  };
}

export function autopoolSummary(a: AutopoolChatMeta): string {
  const when = a.slotTime ? formatDepart(a.slotTime) : 'now';
  // Split-fare estimate omitted until the pricing algorithm is reworked (#7).
  return `You're pooling ${a.routeLabel} at ${when}. Coordinate the pickup point below.`;
}
