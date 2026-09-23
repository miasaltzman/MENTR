-- The 1% system: daily actions, completions, weekly priorities, check-ins,
-- and a progress summary that celebrates cumulative work (no guilt streaks).

create table public.daily_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action_date date not null,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  why text not null,
  category public.action_category not null,
  estimated_minutes smallint not null check (estimated_minutes between 1 and 120),
  difficulty public.action_difficulty not null default 'standard',
  status public.action_status not null default 'pending',
  is_primary boolean not null default true,
  milestone_id uuid,
  replaced_by_id uuid,
  resource_id uuid references public.resources (id) on delete set null,
  origin public.origin not null default 'ai',
  skip_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (milestone_id, user_id)
    references public.roadmap_milestones (id, user_id) on delete set null (milestone_id),
  foreign key (replaced_by_id, user_id)
    references public.daily_actions (id, user_id) on delete set null (replaced_by_id)
);

-- At most one live primary action per user per day (replaced ones are history).
create unique index daily_actions_one_primary
  on public.daily_actions (user_id, action_date)
  where is_primary and status <> 'replaced';
create index daily_actions_user_date on public.daily_actions (user_id, action_date desc);

create trigger daily_actions_updated_at before update on public.daily_actions
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.daily_actions');

create table public.action_completions (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  reflection text,
  minutes_spent smallint check (minutes_spent is null or minutes_spent between 0 and 600),
  unique (action_id),
  foreign key (action_id, user_id)
    references public.daily_actions (id, user_id) on delete cascade
);

create index action_completions_user on public.action_completions (user_id, completed_at desc);

select public.apply_owner_rls('public.action_completions');

create table public.weekly_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 1 and 300),
  why text,
  category public.action_category,
  milestone_id uuid,
  status text not null default 'open' check (status in ('open', 'done', 'dropped')),
  position smallint not null default 0,
  origin public.origin not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (milestone_id, user_id)
    references public.roadmap_milestones (id, user_id) on delete set null (milestone_id),
  check (extract(isodow from week_start) = 1)
);

create index weekly_priorities_user_week on public.weekly_priorities (user_id, week_start);

create trigger weekly_priorities_updated_at before update on public.weekly_priorities
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.weekly_priorities');

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  progress_note text,
  changes_note text,
  difficulties_note text,
  next_priority_note text,
  mentor_summary text,
  applied_changes jsonb not null default '[]',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create trigger weekly_checkins_updated_at before update on public.weekly_checkins
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.weekly_checkins');

-- Progress summary for the signed-in user. SECURITY INVOKER so RLS applies.
-- p_today should be the user's local date (defaults to the server date).
create or replace function public.get_progress_summary(
  p_since date default null,
  p_today date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with done as (
    select a.category, a.action_date
    from public.daily_actions a
    where a.user_id = (select auth.uid())
      and a.status = 'completed'
      and (p_since is null or a.action_date >= p_since)
  ),
  recent as (
    select count(distinct a.action_date) as days
    from public.daily_actions a
    where a.user_id = (select auth.uid())
      and a.status = 'completed'
      and a.action_date > coalesce(p_today, current_date) - 7
      and a.action_date <= coalesce(p_today, current_date)
  )
  select jsonb_build_object(
    'total_completed', (select count(*) from done),
    'by_category', coalesce(
      (select jsonb_object_agg(category, n)
         from (select category, count(*) as n from done group by category) c),
      '{}'::jsonb),
    'active_days_last_7', (select days from recent),
    'milestones_completed', (
      select count(*) from public.roadmap_milestones m
      where m.user_id = (select auth.uid())
        and m.status = 'completed'
        and (p_since is null or m.completed_at >= p_since)
    )
  );
$$;

grant execute on function public.get_progress_summary(date, date) to authenticated;
revoke execute on function public.get_progress_summary(date, date) from anon;
