import { supabase } from './supabase';
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
  if (error || !data) throw new Error('Could not start your search. Try again.');
  return data.id as string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
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
  const { matches } = await post<{ matches: Match[] }>('/match', { request_id: requestId });
  return matches;
}

export async function requestDrivers(requestId: string, tokenIds: string[]): Promise<void> {
  await post('/request', { request_id: requestId, token_ids: tokenIds });
}
