import { supabase } from './supabase';

// All of this hits SECURITY DEFINER RPCs guarded by is_admin() server-side
// (see supabase/migrations/0015_admin.sql) -- a non-admin session gets a
// Postgres exception on every call here, not just a client-side gate.

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return !!data;
}

export type PendingDriverApplication = {
  verification_id: string;
  profile_id: string;
  amizone_id: string;
  full_name: string;
  phone: string | null;
  vehicle_type: 'car' | 'bike' | null;
  make_model: string | null;
  color: string | null;
  plate_number: string | null;
  seats: number | null;
  licence_path: string;
  created_at: string;
};

export async function getPendingDriverApplications(): Promise<PendingDriverApplication[]> {
  const { data, error } = await supabase.rpc('admin_pending_driver_applications');
  if (error) throw new Error(error.message);
  return (data as PendingDriverApplication[]) ?? [];
}

export async function getLicenceSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('licences').createSignedUrl(path, 300);
  if (error || !data) throw new Error('Could not load licence photo.');
  return data.signedUrl;
}

export async function approveDriverApplication(amizoneId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_driver', { p_amizone_id: amizoneId });
  if (error) throw new Error(error.message);
}

export async function rejectDriverApplication(amizoneId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_driver', { p_amizone_id: amizoneId, p_reason: reason ?? null });
  if (error) throw new Error(error.message);
}

export type AdminProfile = {
  id: string;
  amizone_id: string;
  full_name: string;
  role: 'student' | 'faculty' | 'staff';
  phone: string | null;
  is_driver_verified: boolean;
  created_at: string;
};

export async function getAdminProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase.rpc('admin_list_profiles');
  if (error) throw new Error(error.message);
  return (data as AdminProfile[]) ?? [];
}

export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_profile', { p_profile_id: profileId });
  if (error) throw new Error(error.message);
}

export type AdminStats = {
  total_users: number;
  onboarded_users: number;
  pending_driver_applications: number;
  active_ride_tokens: number;
  rides_today: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw new Error(error.message);
  const row = (data as AdminStats[])?.[0];
  if (!row) throw new Error('No stats returned.');
  return row;
}
