-- Mentr foundation: extensions, shared enums, helper functions.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_type as enum (
  'college_student',
  'high_school_student',
  'recent_graduate',
  'working_professional',
  'entrepreneur',
  'career_changer',
  'exploring'
);

-- "Not sure yet" is always a valid answer.
create type public.certainty_level as enum ('yes', 'kind_of', 'no_idea');

create type public.relocation_preference as enum (
  'stay', 'specific', 'open', 'remote', 'not_sure'
);

create type public.onboarding_status as enum ('not_started', 'in_progress', 'completed');

create type public.horizon as enum ('long_term', 'year', 'term', 'month', 'week', 'today');

create type public.milestone_status as enum ('not_started', 'in_progress', 'completed', 'skipped');

create type public.action_status as enum ('pending', 'completed', 'skipped', 'replaced');

create type public.action_category as enum (
  'skills', 'networking', 'experience', 'career_exploration',
  'applications', 'learning', 'business'
);

create type public.action_difficulty as enum ('lighter', 'standard', 'stretch');

-- Where a record came from. AI-generated records are always marked as such.
create type public.origin as enum ('ai', 'user', 'checkin', 'chat', 'system', 'onboarding');

create type public.verification_status as enum ('verified', 'unverified', 'stale', 'broken');

create type public.skill_category as enum (
  'technical', 'industry', 'communication', 'leadership',
  'business', 'networking', 'portfolio', 'interviewing'
);

create type public.goal_status as enum ('active', 'achieved', 'paused', 'dropped');

create type public.visibility as enum ('private', 'public');

create type public.roadmap_kind as enum ('career', 'venture');

create type public.message_role as enum ('user', 'assistant');

create type public.memory_kind as enum ('fact', 'preference', 'goal', 'concern', 'decision', 'context');

create type public.university_resource_type as enum (
  'career_center', 'career_portal', 'academic_advising', 'internships',
  'tutoring', 'alumni', 'entrepreneurship', 'incubator', 'research',
  'study_abroad', 'scholarships', 'professional_development', 'departments',
  'career_fairs', 'student_organizations', 'library', 'wellbeing', 'other'
);

create type public.resource_kind as enum (
  'course', 'video', 'article', 'book', 'certification', 'tutorial',
  'project', 'podcast', 'community', 'tool'
);

create type public.recommendation_entity as enum (
  'resource', 'university_resource', 'club', 'person', 'opportunity',
  'news_item', 'career_path', 'milestone', 'project_idea'
);

create type public.feedback_type as enum (
  'saved', 'dismissed', 'not_interested', 'joined', 'completed', 'helpful', 'not_helpful'
);

create type public.daily_reminder_frequency as enum ('off', 'daily');
create type public.opportunity_alert_level as enum ('off', 'important', 'all');
create type public.industry_update_frequency as enum ('off', 'daily_digest', 'weekly_digest');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Standard owner-only RLS for a table with a user_id column.
-- Used by later migrations to keep policies uniform and auditable.
create or replace function public.apply_owner_rls(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format(
    'create policy "owner_select" on %s for select to authenticated using (user_id = (select auth.uid()))',
    p_table);
  execute format(
    'create policy "owner_insert" on %s for insert to authenticated with check (user_id = (select auth.uid()))',
    p_table);
  execute format(
    'create policy "owner_update" on %s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
    p_table);
  execute format(
    'create policy "owner_delete" on %s for delete to authenticated using (user_id = (select auth.uid()))',
    p_table);
  execute format('grant select, insert, update, delete on %s to authenticated', p_table);
  execute format('revoke all on %s from anon', p_table);
end;
$$;

-- Reference catalogs: readable by signed-in users, writable only by service_role.
create or replace function public.apply_catalog_rls(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format(
    'create policy "catalog_read" on %s for select to authenticated using (true)',
    p_table);
  execute format('grant select on %s to authenticated', p_table);
  execute format('revoke all on %s from anon', p_table);
end;
$$;

revoke execute on function public.apply_owner_rls(regclass) from public, anon, authenticated;
revoke execute on function public.apply_catalog_rls(regclass) from public, anon, authenticated;
