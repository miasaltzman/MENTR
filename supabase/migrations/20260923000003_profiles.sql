-- User profile, education, work, venture, preferences, goals, interests, skills.
-- All private to the owner.

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  first_name text,
  user_type public.user_type,
  onboarding_status public.onboarding_status not null default 'not_started',
  onboarding_step text,
  onboarding_completed_at timestamptz,
  timezone text not null default 'UTC',
  current_city text,
  current_region text,
  current_country text,
  relocation_preference public.relocation_preference,
  preferred_locations text[] not null default '{}',
  open_to_remote boolean,
  career_certainty public.certainty_level,
  -- Reserved for a future social layer; everything is private in V1.
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profile_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profile_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- education_profiles / user_majors
-- ---------------------------------------------------------------------------
create table public.education_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid references public.universities (id) on delete set null,
  -- Free-text school name for schools not (yet) in the catalog, e.g. high schools.
  school_name text,
  level text not null check (level in ('high_school', 'undergraduate', 'graduate', 'bootcamp', 'other')),
  year_in_school text,
  expected_graduation date,
  gpa numeric(3, 2) check (gpa is null or (gpa >= 0 and gpa <= 5)),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index education_profiles_user on public.education_profiles (user_id);
create index education_profiles_university on public.education_profiles (university_id);

create trigger education_profiles_updated_at before update on public.education_profiles
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.education_profiles');

create table public.user_majors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  education_profile_id uuid not null,
  major_id uuid references public.majors (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  kind text not null check (kind in ('major', 'second_major', 'minor')),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  foreign key (education_profile_id, user_id)
    references public.education_profiles (id, user_id) on delete cascade
);

create index user_majors_user on public.user_majors (user_id);

select public.apply_owner_rls('public.user_majors');

-- ---------------------------------------------------------------------------
-- professional_profiles (working professionals, recent grads, career changers)
-- ---------------------------------------------------------------------------
create table public.professional_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_title text,
  current_employer text,
  industry text,
  years_experience numeric(4, 1) check (years_experience is null or years_experience >= 0),
  desired_next_role text,
  desired_career text,
  stuck_points text,
  transferable_skills text[] not null default '{}',
  constraints_note text,
  desired_timeline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger professional_profiles_updated_at before update on public.professional_profiles
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.professional_profiles');

-- ---------------------------------------------------------------------------
-- venture_profiles (entrepreneurs / aspiring founders)
-- ---------------------------------------------------------------------------
create table public.venture_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_primary boolean not null default true,
  has_idea public.certainty_level,
  idea_summary text,
  industry text,
  offering_type text check (offering_type is null or offering_type in ('product', 'service', 'both', 'not_sure')),
  channel text check (channel is null or channel in ('online', 'physical', 'both', 'not_sure')),
  stage text check (stage is null or stage in ('no_idea_yet', 'idea', 'research', 'prototype', 'launched')),
  target_customer text,
  starting_capital_range text,
  experience_summary text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index venture_profiles_one_primary on public.venture_profiles (user_id) where is_primary;

create trigger venture_profiles_updated_at before update on public.venture_profiles
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.venture_profiles');

-- ---------------------------------------------------------------------------
-- user_preferences (all optional)
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_industries text[] not null default '{}',
  companies_admired text[] not null default '{}',
  lifestyle_priorities text[] not null default '{}',
  skills_to_learn text[] not null default '{}',
  salary_goal text,
  grad_school_interest public.certainty_level,
  entrepreneurship_interest public.certainty_level,
  five_year_vision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.user_preferences');

-- ---------------------------------------------------------------------------
-- user_goals / career_interests
-- ---------------------------------------------------------------------------
create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  horizon public.horizon not null default 'year',
  status public.goal_status not null default 'active',
  origin public.origin not null default 'user',
  target_date date,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_goals_user on public.user_goals (user_id, status);

create trigger user_goals_updated_at before update on public.user_goals
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.user_goals');

create table public.career_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  career_path_id uuid references public.career_paths (id) on delete set null,
  label text not null check (char_length(label) between 1 and 200),
  certainty public.certainty_level,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create unique index career_interests_user_label on public.career_interests (user_id, lower(label));

select public.apply_owner_rls('public.career_interests');

-- ---------------------------------------------------------------------------
-- onboarding_responses: raw conversational answers, kept for context/audit.
-- ---------------------------------------------------------------------------
create table public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_key)
);

create trigger onboarding_responses_updated_at before update on public.onboarding_responses
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.onboarding_responses');

-- ---------------------------------------------------------------------------
-- user_skills / skill_evidence
-- ---------------------------------------------------------------------------
create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  category public.skill_category not null default 'technical',
  -- 'current' = the user has it; 'target' = wants to build it.
  status text not null default 'current' check (status in ('current', 'target')),
  level text check (level is null or level in ('learning', 'working', 'strong')),
  origin public.origin not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index user_skills_user_name on public.user_skills (user_id, lower(name));

create trigger user_skills_updated_at before update on public.user_skills
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.user_skills');

create table public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_skill_id uuid not null,
  kind text not null check (kind in ('course', 'project', 'job', 'internship', 'club', 'action', 'certification', 'other')),
  title text not null,
  description text,
  url text,
  occurred_on date,
  created_at timestamptz not null default now(),
  foreign key (user_skill_id, user_id)
    references public.user_skills (id, user_id) on delete cascade
);

create index skill_evidence_skill on public.skill_evidence (user_skill_id);

select public.apply_owner_rls('public.skill_evidence');

-- ---------------------------------------------------------------------------
-- Provision a profile for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');
begin
  insert into public.profiles (id, display_name, first_name)
  values (new.id, v_name, split_part(v_name, ' ', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
