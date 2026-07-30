import { supabase, channelTopic } from './supabase';

export type MatchStatus = {
  kind: 'ride' | 'autopool';
  my_role: 'driver' | 'passenger' | 'pooler';
  other_id: string;
  other_name: string | null;
  other_photo: string | null;
  other_role: 'driver' | 'passenger' | 'pooler';
  vehicle_type: 'car' | 'bike' | null;
  vehicle_seats_total: number | null;
  seats_occupied: number;
  my_seat_index: number | null;
  origin_label: string | null;
  dest_label: string | null;
  route_polyline: string | null;
  depart_at: string | null;
  price_per_seat: number | null;
  pickup_label: string | null;
  drop_label: string | null;
  pickup_lng: number | null;
  pickup_lat: number | null;
  drop_lng: number | null;
  drop_lat: number | null;
  ride_request_id: string | null;
  request_status: 'searching' | 'matched' | 'cancelled' | 'expired' | null;
  completed_at: string | null;
};

export async function getMatchStatus(matchId: string): Promise<MatchStatus | null> {
  const { data } = await supabase.rpc('match_status', { p_match_id: matchId });
  return (data?.[0] as MatchStatus) ?? null;
}

// Disbands THIS match only (other passengers matched to the same driver
// token, if any, are unaffected) and gives the driver's seat back.
export async function cancelMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_match', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

// F8 — ride completion + history. Manual end only (ponytail: no auto-complete
// timeout yet; add via expire_stale_rows if rides get stuck). Ratings were
// removed — the rate screen's post-ride navigation was never reliable.
export async function endRide(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('end_ride', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export type HistoryEntry = {
  match_id: string;
  kind: 'ride' | 'autopool';
  other_name: string | null;
  other_photo: string | null;
  origin_label: string;
  dest_label: string;
  fare: number | null;
  route_code: string | null; // autopool only — client resolves label/fare (see PRESET_ROUTES)
  pool_size: number;
  when_at: string;
  completed: boolean;
};

export async function getRideHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase.rpc('my_ride_history');
  if (error) throw new Error(error.message);
  return (data as HistoryEntry[]) ?? [];
}

// #13 — the passenger's offered price is the agreed fare. Readable by either
// participant via a security-definer fn (see migration 0022).
export async function getMatchOfferedPrice(matchId: string): Promise<number | null> {
  const { data } = await supabase.rpc('match_offered_price', { p_match_id: matchId });
  return (data as number | null) ?? null;
}

// Plain select (RLS: matches_participant_select already permits this) — used by
// the autopool chat screen after a subscribeMatch tick to check for completion,
// without needing a new RPC.
export async function getMatchCompletedAt(matchId: string): Promise<string | null> {
  const { data } = await supabase.from('matches').select('completed_at').eq('id', matchId).maybeSingle();
  return (data as { completed_at: string | null } | null)?.completed_at ?? null;
}

// Realtime on a match row (fires on completed_at set) — used so the party who
// didn't tap "End ride" leaves the ride view live, no refresh needed.
export function subscribeMatch(matchId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(channelTopic(`match-${matchId}`))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
