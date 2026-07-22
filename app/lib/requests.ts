import { supabase } from './supabase';
import { callMatching } from './passenger';

export type Incoming = {
  target_id: string;
  request_id: string;
  token_id: string;
  passenger_name: string;
  passenger_photo: string | null;
  pickup_label: string;
  drop_label: string;
  offered_price: number;
};

export async function getIncoming(driverId: string): Promise<Incoming[]> {
  const { data } = await supabase.rpc('driver_incoming', { p_driver_id: driverId });
  return (data as Incoming[]) ?? [];
}

// Realtime: any change to this driver's targets -> callback (refetch).
export function subscribeDriverTargets(driverId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`targets-${driverId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'request_targets', filter: `driver_id=eq.${driverId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Atomic accept via the matching service. Returns match_id or throws.
export async function acceptRequest(params: {
  requestId: string;
  tokenId: string;
  driverId: string;
}): Promise<string> {
  const { match_id } = await callMatching<{ match_id: string }>('/accept', {
    request_id: params.requestId,
    token_id: params.tokenId,
    driver_id: params.driverId,
  });
  return match_id;
}

// Decline via RPC (not a bare table write): the RPC also propagates to the
// passenger's ride_requests subscription + push when no drivers remain (BUG 2).
export async function declineTarget(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_target', { p_target_id: targetId });
  if (error) throw new Error(error.message);
}

// Full detail for one incoming request, for the dedicated decision screen (BUG 1).
export type IncomingDetail = {
  target_id: string;
  token_id: string;
  driver_id: string;
  passenger_name: string | null;
  passenger_photo: string | null;
  pickup_label: string;
  drop_label: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat: number;
  drop_lng: number;
  route_polyline: string;
  depart_at: string;
  offered_price: number;
};

export async function getIncomingDetail(requestId: string): Promise<IncomingDetail | null> {
  const { data } = await supabase.rpc('incoming_request_detail', { p_request_id: requestId });
  return (data?.[0] as IncomingDetail) ?? null;
}

// Realtime on the driver's MATCHED requests (BUG 3): when a passenger cancels,
// their ride_requests row flips to 'cancelled' -> callback (refetch) so the
// driver's matched-passenger list updates without a manual refresh.
export function subscribeMatchedRequests(driverId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`matched-reqs-${driverId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_requests', filter: `matched_driver_id=eq.${driverId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export type MatchedPassenger = {
  match_id: string;
  request_id: string;
  passenger_name: string | null;
  passenger_photo: string | null;
  pickup_label: string;
  drop_label: string;
  offered_price: number;
};

export async function getMatchedPassengers(tokenId: string): Promise<MatchedPassenger[]> {
  const { data } = await supabase.rpc('driver_matched_passengers', { p_token_id: tokenId });
  return (data as MatchedPassenger[]) ?? [];
}
