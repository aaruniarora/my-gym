-- milestone_tests: one row per recorded test result (per side for per-side tests).
create table if not exists public.milestone_tests (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  test_id text not null,
  side text,
  value numeric not null,
  week int not null,
  date date not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- progress: "I can already do this" queues a check set for the next step.
alter table public.progress add column if not exists check_pending boolean not null default false;

-- milestone_tests: pull index, RLS, owner-only policies, updated_at trigger.
create index if not exists milestone_tests_user_updated_idx on public.milestone_tests (user_id, updated_at);
alter table public.milestone_tests enable row level security;
drop policy if exists milestone_tests_select on public.milestone_tests;
create policy milestone_tests_select on public.milestone_tests for select to authenticated using (user_id = auth.uid());
drop policy if exists milestone_tests_insert on public.milestone_tests;
create policy milestone_tests_insert on public.milestone_tests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists milestone_tests_update on public.milestone_tests;
create policy milestone_tests_update on public.milestone_tests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists milestone_tests_delete on public.milestone_tests;
create policy milestone_tests_delete on public.milestone_tests for delete to authenticated using (user_id = auth.uid());
drop trigger if exists milestone_tests_touch on public.milestone_tests;
create trigger milestone_tests_touch before insert or update on public.milestone_tests for each row execute function public.touch_updated_at();
