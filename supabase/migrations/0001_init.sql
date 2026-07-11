-- Meau — initial schema (see specs/02-DATABASE-SCHEMA.md, specs/08-MATCHING-SERVER.md)

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ============================================================================
-- Tables
-- ============================================================================

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade unique,
  amizone_id text not null unique,
  full_name text not null,
  role text not null check (role in ('student','faculty','staff')),
  batch text,
  department text,
  phone text,
  photo_url text,
  gender text check (gender in ('male','female','other','prefer_not')),
  is_driver_verified boolean not null default false,
  verified_amity boolean not null default true,
  created_at timestamptz default now()
);

create table vehicles (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('car','bike')),
  make_model text,
  color text,
  plate_number text not null,
  seats int not null default 3,
  created_at timestamptz default now()
);

create table driver_verifications (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  licence_image_url text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by text,
  reject_reason text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create table ride_tokens (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id),
  origin_label text not null,
  origin geography(Point,4326) not null,
  dest_label text not null,
  dest geography(Point,4326) not null,
  route_polyline text not null,
  depart_at timestamptz not null,
  seats_total int not null,
  seats_left int not null,
  price_per_seat int not null,
  status text not null default 'live' check (status in ('live','matched','expired','cancelled')),
  created_at timestamptz default now()
);
create index ride_tokens_depart_idx on ride_tokens (depart_at) where status = 'live';
create index ride_tokens_origin_gix on ride_tokens using gist (origin);

create table ride_requests (
  id uuid primary key default uuid_generate_v4(),
  passenger_id uuid references profiles(id) on delete cascade,
  pickup_label text not null,
  pickup geography(Point,4326) not null,
  drop_label text not null,
  drop_point geography(Point,4326) not null,
  desired_time timestamptz not null,
  offered_price int not null,
  status text not null default 'searching' check (status in ('searching','matched','cancelled','expired')),
  matched_token_id uuid references ride_tokens(id),
  matched_driver_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table request_targets (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid references ride_requests(id) on delete cascade,
  token_id uuid references ride_tokens(id) on delete cascade,
  driver_id uuid references profiles(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','accepted','declined','dismissed')),
  created_at timestamptz default now(),
  unique(request_id, token_id)
);

create table auto_pool_sessions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  route_code text not null,
  mode text not null check (mode in ('now','scheduled')),
  slot_time timestamptz,
  status text not null default 'waiting' check (status in ('waiting','matched','cancelled','expired')),
  pool_group_id uuid,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('ride','autopool')),
  ride_token_id uuid references ride_tokens(id),
  ride_request_id uuid references ride_requests(id),
  pool_group_id uuid,
  created_at timestamptz default now()
);

create table match_participants (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  role text check (role in ('driver','passenger','pooler')),
  unique(match_id, profile_id)
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  body text not null,
  kind text default 'text' check (kind in ('text','system','structured')),
  created_at timestamptz default now()
);
create index messages_match_idx on messages (match_id, created_at);

create table push_tokens (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  expo_push_token text not null,
  updated_at timestamptz default now(),
  unique(profile_id, expo_push_token)
);

-- ============================================================================
-- Helper: maps the authenticated auth.uid() to their profiles.id
-- ============================================================================

create or replace function current_profile_id() returns uuid language sql stable as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table driver_verifications enable row level security;
alter table ride_tokens enable row level security;
alter table ride_requests enable row level security;
alter table request_targets enable row level security;
alter table auto_pool_sessions enable row level security;
alter table matches enable row level security;
alter table match_participants enable row level security;
alter table messages enable row level security;
alter table push_tokens enable row level security;

-- profiles: everyone (signed in) can read; only the owner can update.
create policy "profiles_select_all" on profiles for select using (auth.uid() is not null);
create policy "profiles_update_own" on profiles for update using (auth_user_id = auth.uid());
create policy "profiles_insert_own" on profiles for insert with check (auth_user_id = auth.uid());

-- vehicles: owner-only CRUD. Others see vehicle info via the matching service (service role).
create policy "vehicles_owner_crud" on vehicles for all
  using (owner_id = current_profile_id())
  with check (owner_id = current_profile_id());

-- driver_verifications: owner can create/read their own review row.
create policy "driver_verifications_owner_rw" on driver_verifications for select
  using (profile_id = current_profile_id());
create policy "driver_verifications_owner_insert" on driver_verifications for insert
  with check (profile_id = current_profile_id());

-- ride_tokens: driver can CRUD own. No public select — matching runs with service role.
create policy "ride_tokens_owner_crud" on ride_tokens for all
  using (driver_id = current_profile_id())
  with check (driver_id = current_profile_id());

-- ride_requests: passenger owns their request. Targeted drivers can read the request
-- (to show pickup/drop on the incoming-request card).
create policy "ride_requests_owner_crud" on ride_requests for all
  using (passenger_id = current_profile_id())
  with check (passenger_id = current_profile_id());
create policy "ride_requests_targeted_driver_select" on ride_requests for select
  using (exists (
    select 1 from request_targets rt
    where rt.request_id = ride_requests.id and rt.driver_id = current_profile_id()
  ));

-- request_targets: passenger (via their request) and the targeted driver can read.
create policy "request_targets_passenger_select" on request_targets for select
  using (exists (
    select 1 from ride_requests rr
    where rr.id = request_targets.request_id and rr.passenger_id = current_profile_id()
  ));
create policy "request_targets_driver_select" on request_targets for select
  using (driver_id = current_profile_id());

-- auto_pool_sessions: owner-only.
create policy "auto_pool_sessions_owner_crud" on auto_pool_sessions for all
  using (profile_id = current_profile_id())
  with check (profile_id = current_profile_id());

-- matches / match_participants: only participants can read. Rows are written by the
-- matching service using the service role key (bypasses RLS), not by clients directly.
create policy "match_participants_self_select" on match_participants for select
  using (
    profile_id = current_profile_id()
    or match_id in (select mp.match_id from match_participants mp where mp.profile_id = current_profile_id())
  );
create policy "matches_participant_select" on matches for select
  using (exists (
    select 1 from match_participants mp
    where mp.match_id = matches.id and mp.profile_id = current_profile_id()
  ));

-- messages: only match participants can read/insert.
create policy "messages_participant_select" on messages for select
  using (exists (
    select 1 from match_participants mp
    where mp.match_id = messages.match_id and mp.profile_id = current_profile_id()
  ));
create policy "messages_participant_insert" on messages for insert
  with check (
    sender_id = current_profile_id()
    and exists (
      select 1 from match_participants mp
      where mp.match_id = messages.match_id and mp.profile_id = current_profile_id()
    )
  );

-- push_tokens: owner only.
create policy "push_tokens_owner_crud" on push_tokens for all
  using (profile_id = current_profile_id())
  with check (profile_id = current_profile_id());

-- ============================================================================
-- accept_ride_request — atomic race-to-accept (specs/08-MATCHING-SERVER.md POST /accept)
-- Called by the matching service using the service role key, which bypasses RLS.
-- ============================================================================

create or replace function accept_ride_request(
  p_request_id uuid,
  p_token_id uuid,
  p_driver_id uuid
) returns uuid language plpgsql as $$
declare
  v_request ride_requests%rowtype;
  v_token ride_tokens%rowtype;
  v_passenger_id uuid;
  v_match_id uuid;
begin
  select * into v_request from ride_requests where id = p_request_id for update;

  if v_request.id is null then
    raise exception 'request_not_found';
  end if;

  if v_request.status <> 'searching' then
    raise exception 'already_matched';
  end if;

  select * into v_token from ride_tokens where id = p_token_id for update;

  if v_token.id is null or v_token.seats_left < 1 then
    raise exception 'token_unavailable';
  end if;

  v_passenger_id := v_request.passenger_id;

  update ride_requests
    set status = 'matched', matched_token_id = p_token_id, matched_driver_id = p_driver_id
    where id = p_request_id;

  update request_targets
    set state = 'accepted'
    where request_id = p_request_id and token_id = p_token_id;

  update request_targets
    set state = 'dismissed'
    where request_id = p_request_id and token_id <> p_token_id and state = 'pending';

  update ride_tokens
    set seats_left = seats_left - 1,
        status = case when seats_left - 1 <= 0 then 'matched' else status end
    where id = p_token_id;

  insert into matches (kind, ride_token_id, ride_request_id)
    values ('ride', p_token_id, p_request_id)
    returning id into v_match_id;

  insert into match_participants (match_id, profile_id, role) values
    (v_match_id, p_driver_id, 'driver'),
    (v_match_id, v_passenger_id, 'passenger');

  return v_match_id;
end;
$$;

-- ============================================================================
-- Expiry — run every ~60s (matching service cron or a Supabase scheduled function)
-- ============================================================================

create or replace function expire_stale_rows() returns void language plpgsql as $$
begin
  update ride_tokens set status = 'expired' where status = 'live' and depart_at < now();
  update ride_requests set status = 'expired' where status = 'searching' and desired_time < now() - interval '30 minutes';
  update auto_pool_sessions set status = 'expired' where status = 'waiting' and created_at < now() - interval '5 minutes';
end;
$$;
