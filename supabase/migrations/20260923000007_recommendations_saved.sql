-- Recommendations always carry a user-facing reason. Feedback signals
-- (saved / dismissed / not interested...) feed back into ranking.

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type public.recommendation_entity not null,
  -- References a real catalog record when applicable (never AI-invented).
  entity_id uuid,
  title text not null,
  reason text not null,
  signals jsonb not null default '{}',
  score real not null default 0,
  surface text not null default 'dashboard' check (surface in ('dashboard', 'explore', 'campus', 'chat')),
  status text not null default 'active' check (status in ('active', 'dismissed', 'acted', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index recommendations_user_active on public.recommendations (user_id, surface, status, score desc);

create trigger recommendations_updated_at before update on public.recommendations
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.recommendations');

create table public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  feedback public.feedback_type not null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (recommendation_id, user_id)
    references public.recommendations (id, user_id) on delete cascade
);

create index recommendation_feedback_user on public.recommendation_feedback (user_id, created_at desc);

select public.apply_owner_rls('public.recommendation_feedback');

create table public.saved_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  resource_id uuid references public.resources (id) on delete cascade,
  university_resource_id uuid references public.university_resources (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(resource_id, university_resource_id) = 1)
);

create unique index saved_resources_resource on public.saved_resources (user_id, resource_id)
  where resource_id is not null;
create unique index saved_resources_university_resource on public.saved_resources (user_id, university_resource_id)
  where university_resource_id is not null;

select public.apply_owner_rls('public.saved_resources');

-- Users can suggest campus links. Suggestions stay private until reviewed and
-- verified; they are never shown to other users directly.
create table public.resource_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid not null references public.universities (id) on delete cascade,
  type public.university_resource_type not null default 'other',
  name text not null check (char_length(name) between 1 and 200),
  url text not null check (url ~* '^https?://'),
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

select public.apply_owner_rls('public.resource_suggestions');
