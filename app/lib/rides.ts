import { supabase } from './supabase';
import type { Place } from './maps';

export type RideToken = {
  id: string;
  origin_label: string;
  dest_label: string;
  route_polyline: string;
  depart_at: string;
  seats_total: number;
  seats_left: number;
  price_per_seat: number;
  status: 'live' | 'matched' | 'expired' | 'cancelled';
};

export type Vehicle = { id: string; type: 'car' | 'bike'; seats: number; make_model: string | null };

const ewkt = (p: Place) => `SRID=4326;POINT(${p.longitude} ${p.latitude})`;

export async function getMyVehicle(profileId: string): Promise<Vehicle | null> {
  const { data } = await supabase
    .from('vehicles')
    .select('id, type, seats, make_model')
    .eq('owner_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Vehicle) ?? null;
}

export async function getMyActiveToken(profileId: string): Promise<RideToken | null> {
  const { data } = await supabase
    .from('ride_tokens')
    .select('id, origin_label, dest_label, route_polyline, depart_at, seats_total, seats_left, price_per_seat, status')
    .eq('driver_id', profileId)
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RideToken) ?? null;
}

export async function createRideToken(params: {
  driverId: string;
  vehicleId: string;
  origin: Place;
  dest: Place;
  routePolyline: string;
  departAt: Date;
  seats: number;
  pricePerSeat: number;
}): Promise<void> {
  const { error } = await supabase.from('ride_tokens').insert({
    driver_id: params.driverId,
    vehicle_id: params.vehicleId,
    origin_label: params.origin.label,
    origin: ewkt(params.origin),
    dest_label: params.dest.label,
    dest: ewkt(params.dest),
    route_polyline: params.routePolyline,
    depart_at: params.departAt.toISOString(),
    seats_total: params.seats,
    seats_left: params.seats,
    price_per_seat: params.pricePerSeat,
    status: 'live',
  });
  if (error) throw new Error('Could not post your ride. Try again.');
}

export async function cancelRideToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('ride_tokens')
    .update({ status: 'cancelled' })
    .eq('id', tokenId);
  if (error) throw new Error('Could not cancel the ride. Try again.');
}
