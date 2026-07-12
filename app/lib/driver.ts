import { supabase } from './supabase';

export type DriverStatus = 'none' | 'pending' | 'approved' | 'rejected';

// Latest licence-review state for a profile.
export async function getDriverStatus(
  profileId: string
): Promise<{ status: DriverStatus; reason: string | null }> {
  const { data } = await supabase
    .from('driver_verifications')
    .select('status, reject_reason')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { status: 'none', reason: null };
  return { status: data.status as DriverStatus, reason: data.reject_reason ?? null };
}

export type VehicleInput = {
  type: 'car' | 'bike';
  make_model: string;
  color: string;
  plate_number: string;
  seats: number;
};

// Upload the licence to the private `licences` bucket, then create the vehicle
// and a pending driver_verifications row (both allowed by owner RLS).
export async function submitDriverApplication(params: {
  profileId: string;
  authUserId: string;
  licenceUri: string;
  vehicle: VehicleInput;
}): Promise<void> {
  const { profileId, authUserId, licenceUri, vehicle } = params;

  const ext = (licenceUri.split('.').pop() || 'jpg').toLowerCase();
  const path = `${authUserId}/licence-${Date.now()}.${ext}`;
  const bytes = await fetch(licenceUri).then((r) => r.arrayBuffer());
  const { error: upErr } = await supabase.storage.from('licences').upload(path, bytes, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: true,
  });
  if (upErr) throw new Error('Could not upload your licence. Try again.');

  const { error: vErr } = await supabase.from('vehicles').insert({
    owner_id: profileId,
    type: vehicle.type,
    make_model: vehicle.make_model,
    color: vehicle.color,
    plate_number: vehicle.plate_number,
    seats: vehicle.seats,
  });
  if (vErr) throw new Error('Could not save your vehicle. Try again.');

  const { error: dErr } = await supabase.from('driver_verifications').insert({
    profile_id: profileId,
    licence_image_url: path,
    status: 'pending',
  });
  if (dErr) throw new Error('Could not submit for review. Try again.');
}
