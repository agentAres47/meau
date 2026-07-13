import { supabase } from './supabase';

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
