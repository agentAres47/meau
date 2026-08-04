import { supabase } from './supabase';
import type { Place } from './maps';

// F4 — Daily Commute routines. A routine is a description of a trip the driver
// makes regularly; the server (publish_due_commutes, migration 0031) turns it
// into a real ride_tokens row shortly before each matching departure. Nothing
// here publishes anything itself — that would put the schedule at the mercy of
// the app being open.

export type CommuteRoutine = {
  id: string;
  vehicle_id: string;
  origin_label: string;
  dest_label: string;
  // Postgres `dow`: 0 = Sunday … 6 = Saturday, same as JS Date.getDay().
  days_of_week: number[];
  depart_time: string; // 'HH:MM:SS'
  seats: number;
  price_per_seat: number;
  status: 'active' | 'paused';
  last_published_on: string | null;
};

const ewkt = (p: Place) => `SRID=4326;POINT(${p.longitude} ${p.latitude})`;

export async function listRoutines(driverId: string): Promise<CommuteRoutine[]> {
  const { data, error } = await supabase
    .from('commute_routines')
    .select('id, vehicle_id, origin_label, dest_label, days_of_week, depart_time, seats, price_per_seat, status, last_published_on')
    .eq('driver_id', driverId)
    .order('depart_time', { ascending: true });
  // Surfaced, not swallowed: an empty list and a failed query must not look the
  // same on screen (that exact confusion hid a broken my_ride_history for
  // weeks — see migration 0029).
  if (error) throw new Error(error.message);
  return (data as CommuteRoutine[]) ?? [];
}

export async function createRoutine(params: {
  driverId: string;
  vehicleId: string;
  origin: Place;
  dest: Place;
  routePolyline: string;
  daysOfWeek: number[];
  // 'HH:MM' local wall-clock — resolved against Asia/Kolkata server-side.
  departTime: string;
  seats: number;
  pricePerSeat: number;
}): Promise<void> {
  const { error } = await supabase.from('commute_routines').insert({
    driver_id: params.driverId,
    vehicle_id: params.vehicleId,
    origin_label: params.origin.label,
    origin: ewkt(params.origin),
    dest_label: params.dest.label,
    dest: ewkt(params.dest),
    route_polyline: params.routePolyline,
    days_of_week: params.daysOfWeek,
    depart_time: params.departTime,
    seats: params.seats,
    price_per_seat: params.pricePerSeat,
    status: 'active',
  });
  if (error) throw new Error('Could not save this routine. Try again.');
}

export async function setRoutineStatus(id: string, status: 'active' | 'paused'): Promise<void> {
  const { error } = await supabase.from('commute_routines').update({ status }).eq('id', id);
  if (error) throw new Error('Could not update this routine. Try again.');
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from('commute_routines').delete().eq('id', id);
  if (error) throw new Error('Could not delete this routine. Try again.');
}

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// "Mon–Fri" / "Weekends" / "Mon, Wed, Fri" — a routine's schedule read back the
// way a person would say it.
export function describeDays(days: number[]): string {
  const set = [...days].sort((a, b) => a - b);
  if (set.length === 7) return 'Every day';
  if (set.length === 5 && set.every((d) => d >= 1 && d <= 5)) return 'Mon–Fri';
  if (set.length === 2 && set.includes(0) && set.includes(6)) return 'Weekends';
  return set.map((d) => DAY_NAMES[d]).join(', ');
}

// '09:00:00' -> '9:00 am'
export function describeTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
