-- Shared trigger: server assigns updated_at on insert and update so pull cursors are consistent across devices.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- settings: one jsonb blob per user.
create table if not exists public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

-- progress: one row per skill tree (or tree:side).
create table if not exists public.progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  tree_id text not null,
  side text,
  step_index int not null,
  hits int not null,
  misses int not null,
  dropped_until timestamptz,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, key)
);

-- sessions: one row per workout.
create table if not exists public.sessions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan jsonb not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null,
  pain_events jsonb not null default '[]'::jsonb,
  too_hard_events jsonb not null default '[]'::jsonb,
  note text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- set_logs: one row per logged set.
create table if not exists public.set_logs (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  set_index int not null,
  reps int,
  seconds int,
  side text,
  reps_left int not null,
  weight_kg numeric,
  band_ids jsonb,
  setup text,
  cm_from_floor numeric,
  note text,
  mode text not null,
  at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- settings: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists settings_user_updated_idx on public.settings (user_id, updated_at);
alter table public.settings enable row level security;
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (user_id = auth.uid());
drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists settings_delete on public.settings;
create policy settings_delete on public.settings for delete to authenticated using (user_id = auth.uid());
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before insert or update on public.settings for each row execute function public.touch_updated_at();

-- progress: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists progress_user_updated_idx on public.progress (user_id, updated_at);
alter table public.progress enable row level security;
drop policy if exists progress_select on public.progress;
create policy progress_select on public.progress for select to authenticated using (user_id = auth.uid());
drop policy if exists progress_insert on public.progress;
create policy progress_insert on public.progress for insert to authenticated with check (user_id = auth.uid());
drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists progress_delete on public.progress;
create policy progress_delete on public.progress for delete to authenticated using (user_id = auth.uid());
drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before insert or update on public.progress for each row execute function public.touch_updated_at();

-- sessions: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists sessions_user_updated_idx on public.sessions (user_id, updated_at);
alter table public.sessions enable row level security;
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated using (user_id = auth.uid());
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions for delete to authenticated using (user_id = auth.uid());
drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch before insert or update on public.sessions for each row execute function public.touch_updated_at();

-- set_logs: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists set_logs_user_updated_idx on public.set_logs (user_id, updated_at);
alter table public.set_logs enable row level security;
drop policy if exists set_logs_select on public.set_logs;
create policy set_logs_select on public.set_logs for select to authenticated using (user_id = auth.uid());
drop policy if exists set_logs_insert on public.set_logs;
create policy set_logs_insert on public.set_logs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists set_logs_update on public.set_logs;
create policy set_logs_update on public.set_logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists set_logs_delete on public.set_logs;
create policy set_logs_delete on public.set_logs for delete to authenticated using (user_id = auth.uid());
drop trigger if exists set_logs_touch on public.set_logs;
create trigger set_logs_touch before insert or update on public.set_logs for each row execute function public.touch_updated_at();
