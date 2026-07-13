-- Enable Supabase Realtime on the tables the app subscribes to (Phase 5/6).
-- RLS still applies to realtime, so subscribers only receive rows they can select.
-- Idempotent: skip tables already in the publication.

do $$
begin
  alter publication supabase_realtime add table ride_requests;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table request_targets;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

-- Pending incoming requests for a driver (invoker rights → RLS applies; the
-- driver can see targets addressed to them + those requests + passenger name).
create or replace function driver_incoming(p_driver_id uuid)
returns table (
  target_id uuid, request_id uuid, token_id uuid, state text,
  passenger_name text, passenger_photo text,
  pickup_label text, drop_label text, offered_price int, created_at timestamptz
) language sql stable as $$
  select rt.id, rt.request_id, rt.token_id, rt.state,
    p.full_name, p.photo_url, r.pickup_label, r.drop_label, r.offered_price, rt.created_at
  from request_targets rt
  join ride_requests r on r.id = rt.request_id
  join profiles p on p.id = r.passenger_id
  where rt.driver_id = p_driver_id and rt.state = 'pending'
  order by rt.created_at desc
$$;

-- Passenger cancels their own searching request and dismisses its pending targets
-- (security definer: passengers can't write request_targets directly under RLS).
create or replace function cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ride_requests set status = 'cancelled'
    where id = p_request_id and passenger_id = current_profile_id() and status = 'searching';
  update request_targets set state = 'dismissed'
    where request_id = p_request_id and state = 'pending';
end $$;
