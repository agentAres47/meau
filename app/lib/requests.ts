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

export async function declineTarget(targetId: string): Promise<void> {
  await supabase.from('request_targets').update({ state: 'declined' }).eq('id', targetId);
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
