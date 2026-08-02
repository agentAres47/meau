import { supabase, channelTopic } from './supabase';
import { logDbError } from './dbError';
import type { Place } from './maps';

const MATCHING = process.env.EXPO_PUBLIC_MATCHING_SERVICE_URL;

const ewkt = (p: Place) => `SRID=4326;POINT(${p.longitude} ${p.latitude})`;

export type Match = {
  token_id: string;
  driver_id: string;
  driver: { name: string; photo: string | null; verified: boolean };
  vehicle: { make_model: string | null; color: string | null; type: string | null };
  origin_label: string;
  dest_label: string;
  route_polyline: string;
  depart_at: string;
  seats_left: number;
  price_per_seat: number;
  detour_m: number;
  time_delta_min: number;
};

// Create the passenger's searching request, return its id.
export async function createRideRequest(params: {
  passengerId: string;
  pickup: Place;
  drop: Place;
  desiredTime: Date;
  offeredPrice: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from('ride_requests')
    .insert({
      passenger_id: params.passengerId,
      pickup_label: params.pickup.label,
      pickup: ewkt(params.pickup),
      drop_label: params.drop.label,
      drop_point: ewkt(params.drop),
      desired_time: params.desiredTime.toISOString(),
      offered_price: params.offeredPrice,
      status: 'searching',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Search failed: ${error.message}`);
  if (!data) throw new Error('Could not start your search. Try again.');
  return data.id as string;
}

// Shared POST to the matching service with a hard timeout.
export async function callMatching<T>(path: string, body: unknown): Promise<T> {
  if (!MATCHING) throw new Error('Matching service is not configured.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${MATCHING}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`match_${res.status}`);
    return (await res.json()) as T;
  } catch {
    throw new Error("Couldn't reach the matching service. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

export async function matchRides(requestId: string): Promise<Match[]> {
  const { matches } = await callMatching<{ matches: Match[] }>('/match', { request_id: requestId });
  return matches;
}

export async function requestDrivers(requestId: string, tokenIds: string[]): Promise<void> {
  await callMatching('/request', { request_id: requestId, token_ids: tokenIds });
}

export type RequestState = {
  status: 'searching' | 'matched' | 'cancelled' | 'expired';
  matched_driver_id: string | null;
  matched_token_id: string | null;
};

export async function getRequestState(requestId: string): Promise<RequestState | null> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('status, matched_driver_id, matched_token_id')
    .eq('id', requestId)
    .maybeSingle();
  logDbError('getRequestState', error);
  return (data as RequestState) ?? null;
}

// Realtime on the passenger's own request row -> callback on any change.
export function subscribeRequest(requestId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(channelTopic(`request-${requestId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_requests', filter: `id=eq.${requestId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getMatchId(requestId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('ride_request_id', requestId)
    .maybeSingle();
  logDbError('getMatchId', error);
  return (data?.id as string) ?? null;
}

export async function cancelRequest(requestId: string): Promise<void> {
  await supabase.rpc('cancel_request', { p_request_id: requestId });
}

export type ActiveRequest = {
  id: string;
  status: 'searching' | 'matched';
  matched_driver_id: string | null;
};

// The passenger's current live request, if any (used to gate re-requesting).
export async function getActiveRequest(passengerId: string): Promise<ActiveRequest | null> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('id, status, matched_driver_id')
    .eq('passenger_id', passengerId)
    .in('status', ['searching', 'matched'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  logDbError('getActiveRequest', error);
  return (data as ActiveRequest) ?? null;
}
