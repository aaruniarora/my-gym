-- health_daily: one row per day from Garmin or manual entry; manual fields win over Garmin.
create table if not exists public.health_daily (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  period_flow text,
  cramps int,
  sleep_hours numeric,
  sleep_score int,
  body_battery int,
  readiness int,
  resting_hr int,
  hrv int,
  source text not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, date)
);

-- checkins: optional daily "how are you today" answers.
create table if not exists public.checkins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  energy int,
  sleep_quality int,
  period_flow text,
  cramps int,
  notes text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, date)
);

-- activities: other training (dance, taekwondo, run) that affects the plan.
create table if not exists public.activities (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  date date not null,
  type text not null,
  minutes int not null,
  intensity text not null,
  stretched boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- garmin_status: written by the sync Action, read by the app.
create table if not exists public.garmin_status (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  last_ok timestamptz,
  last_error text,
  last_attempt timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

-- health_daily: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists health_daily_user_updated_idx on public.health_daily (user_id, updated_at);
alter table public.health_daily enable row level security;
drop policy if exists health_daily_select on public.health_daily;
create policy health_daily_select on public.health_daily for select to authenticated using (user_id = auth.uid());
drop policy if exists health_daily_insert on public.health_daily;
create policy health_daily_insert on public.health_daily for insert to authenticated with check (user_id = auth.uid());
drop policy if exists health_daily_update on public.health_daily;
create policy health_daily_update on public.health_daily for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists health_daily_delete on public.health_daily;
create policy health_daily_delete on public.health_daily for delete to authenticated using (user_id = auth.uid());
drop trigger if exists health_daily_touch on public.health_daily;
create trigger health_daily_touch before insert or update on public.health_daily for each row execute function public.touch_updated_at();

-- checkins: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists checkins_user_updated_idx on public.checkins (user_id, updated_at);
alter table public.checkins enable row level security;
drop policy if exists checkins_select on public.checkins;
create policy checkins_select on public.checkins for select to authenticated using (user_id = auth.uid());
drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert to authenticated with check (user_id = auth.uid());
drop policy if exists checkins_update on public.checkins;
create policy checkins_update on public.checkins for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists checkins_delete on public.checkins;
create policy checkins_delete on public.checkins for delete to authenticated using (user_id = auth.uid());
drop trigger if exists checkins_touch on public.checkins;
create trigger checkins_touch before insert or update on public.checkins for each row execute function public.touch_updated_at();

-- activities: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists activities_user_updated_idx on public.activities (user_id, updated_at);
alter table public.activities enable row level security;
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select to authenticated using (user_id = auth.uid());
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated with check (user_id = auth.uid());
drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities for delete to authenticated using (user_id = auth.uid());
drop trigger if exists activities_touch on public.activities;
create trigger activities_touch before insert or update on public.activities for each row execute function public.touch_updated_at();

-- garmin_status: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists garmin_status_user_updated_idx on public.garmin_status (user_id, updated_at);
alter table public.garmin_status enable row level security;
drop policy if exists garmin_status_select on public.garmin_status;
create policy garmin_status_select on public.garmin_status for select to authenticated using (user_id = auth.uid());
drop policy if exists garmin_status_insert on public.garmin_status;
create policy garmin_status_insert on public.garmin_status for insert to authenticated with check (user_id = auth.uid());
drop policy if exists garmin_status_update on public.garmin_status;
create policy garmin_status_update on public.garmin_status for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists garmin_status_delete on public.garmin_status;
create policy garmin_status_delete on public.garmin_status for delete to authenticated using (user_id = auth.uid());
drop trigger if exists garmin_status_touch on public.garmin_status;
create trigger garmin_status_touch before insert or update on public.garmin_status for each row execute function public.touch_updated_at();
