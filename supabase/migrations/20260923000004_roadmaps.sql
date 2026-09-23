-- Adaptive roadmaps: one active roadmap per user per kind, milestones grouped
-- by horizon, and a revision log explaining every change.

create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.roadmap_kind not null default 'career',
  title text not null,
  north_star text,
  -- 'exploring' roadmaps focus on discovering direction before committing.
  mode text not null default 'directed' check (mode in ('directed', 'exploring')),
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1,
  origin public.origin not null default 'ai',
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index roadmaps_one_active on public.roadmaps (user_id, kind) where status = 'active';

create trigger roadmaps_updated_at before update on public.roadmaps
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.roadmaps');

create table public.roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid,
  horizon public.horizon not null,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  why text,
  category public.action_category,
  status public.milestone_status not null default 'not_started',
  position integer not null default 0,
  target_start date,
  target_end date,
  completed_at timestamptz,
  origin public.origin not null default 'ai',
  -- Set when a mentor chat suggestion was added to the roadmap.
  source_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (roadmap_id, user_id)
    references public.roadmaps (id, user_id) on delete cascade,
  foreign key (parent_id, user_id)
    references public.roadmap_milestones (id, user_id) on delete set null (parent_id),
  check (target_end is null or target_start is null or target_end >= target_start)
);

create index roadmap_milestones_roadmap on public.roadmap_milestones (roadmap_id, horizon, position);
create index roadmap_milestones_user_status on public.roadmap_milestones (user_id, status);

create trigger roadmap_milestones_updated_at before update on public.roadmap_milestones
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.roadmap_milestones');

create table public.roadmap_revisions (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cause text not null check (cause in (
    'initial', 'milestone_completed', 'checkin', 'goal_change', 'chat', 'manual'
  )),
  summary text not null,
  changes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  foreign key (roadmap_id, user_id)
    references public.roadmaps (id, user_id) on delete cascade
);

create index roadmap_revisions_roadmap on public.roadmap_revisions (roadmap_id, created_at desc);

select public.apply_owner_rls('public.roadmap_revisions');
