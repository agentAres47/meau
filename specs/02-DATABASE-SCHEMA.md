# 02 — Database Schema (Supabase / Postgres)

Enable extensions: `postgis` (for geo proximity), `uuid-ossp`.

```sql
create extension if not exists postgis;
create extension if not exists "uuid-ossp";
```

## profiles
One row per verified user. Created after Amizone verification succeeds.
```sql
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade unique,
  amizone_id text not null unique,            -- enrollment / employee id
  full_name text not null,
  role text not null check (role in ('student','faculty','staff')),
  batch text,                                  -- programme/batch for students
  department text,
  phone text,
  photo_url text,
  gender text check (gender in ('male','female','other','prefer_not')),
  is_driver_verified boolean not null default false,
  verified_amity boolean not null default true,
  created_at timestamptz default now()
);
```

## vehicles
```sql
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
```

## driver_verifications
Licence review queue.
```sql
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
```

## ride_tokens
A live driver offer. NOT publicly listed — surfaced only via match queries.
```sql
create table ride_tokens (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id),
  origin_label text not null,
  origin geography(Point,4326) not null,
  dest_label text not null,
  dest geography(Point,4326) not null,
  route_polyline text not null,               -- encoded polyline from Directions API
  depart_at timestamptz not null,
  seats_total int not null,
  seats_left int not null,
  price_per_seat int not null,                -- INR
  status text not null default 'live' check (status in ('live','matched','expired','cancelled')),
  created_at timestamptz default now()
);
create index ride_tokens_depart_idx on ride_tokens (depart_at) where status = 'live';
create index ride_tokens_origin_gix on ride_tokens using gist (origin);
```

## ride_requests
A passenger requesting to join a token (may fan out to multiple drivers).
```sql
create table ride_requests (
  id uuid primary key default uuid_generate_v4(),
  passenger_id uuid references profiles(id) on delete cascade,
  pickup_label text not null,
  pickup geography(Point,4326) not null,
  drop_label text not null,
  drop_point geography(Point,4326) not null,
  desired_time timestamptz not null,
  offered_price int not null,                 -- INR passenger offers
  status text not null default 'searching' check (status in ('searching','matched','cancelled','expired')),
  matched_token_id uuid references ride_tokens(id),
  matched_driver_id uuid references profiles(id),
  created_at timestamptz default now()
);
```

## request_targets
Which drivers a given request was blasted to (for race-to-accept + auto-dismiss).
```sql
create table request_targets (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid references ride_requests(id) on delete cascade,
  token_id uuid references ride_tokens(id) on delete cascade,
  driver_id uuid references profiles(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','accepted','declined','dismissed')),
  created_at timestamptz default now(),
  unique(request_id, token_id)
);
```

## auto_pool_sessions
Auto pool — both "now" and "scheduled".
```sql
create table auto_pool_sessions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  route_code text not null,                   -- e.g. 'AMITY_STATION'
  mode text not null check (mode in ('now','scheduled')),
  slot_time timestamptz,                       -- null for 'now'
  status text not null default 'waiting' check (status in ('waiting','matched','cancelled','expired')),
  pool_group_id uuid,                          -- assigned when matched
  created_at timestamptz default now()
);
```

## matches (unified match record) + chat
```sql
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
```

## push_tokens
```sql
create table push_tokens (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  expo_push_token text not null,
  updated_at timestamptz default now(),
  unique(profile_id, expo_push_token)
);
```

## RLS (Row Level Security) — enable on all tables
General rules:
- `profiles`: a user can read all profiles (needed to show driver/passenger info) but update only their own. Consider a public view exposing only safe columns (name, photo, role, verified, rating) — do NOT expose phone until matched.
- `ride_tokens`: driver can CRUD own; others can only read via the matching service (service role) — so keep direct select restricted, matching runs with service role.
- `ride_requests`/`request_targets`: passenger owns request; driver can read targets addressed to them.
- `messages`: only match participants can read/insert for that match_id.
- `push_tokens`: owner only.

Write explicit policies for each. Use `auth.uid()` mapped through `profiles.auth_user_id`. Provide a helper:
```sql
create or replace function current_profile_id() returns uuid language sql stable as $$
  select id from profiles where auth_user_id = auth.uid()
$$;
```

## Expiry job
A scheduled Supabase function (or cron in matching service) that every minute sets `ride_tokens.status='expired'` where `depart_at < now()` and status='live', and similarly expires stale requests / pool sessions.
