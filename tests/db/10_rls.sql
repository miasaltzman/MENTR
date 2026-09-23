-- Row-level security and integrity tests. Any failure raises an exception.
\o /dev/null

create or replace function pg_temp.assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
end $$;

-- Runs `sql` and asserts it fails with SQLSTATE `code`.
create or replace function pg_temp.expect_error(sql text, code text, msg text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'ASSERTION FAILED (no error): %', msg;
exception
  when others then
    if sqlstate = 'P0001' and sqlerrm like 'ASSERTION FAILED%' then
      raise;
    end if;
    if sqlstate <> code then
      raise exception 'ASSERTION FAILED: % (expected %, got % — %)', msg, code, sqlstate, sqlerrm;
    end if;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Every public table must have RLS enabled.
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'all public tables have RLS: missing on ' || coalesce(
    (select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity), ''));

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', '{"full_name": "Avery Stone"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', '{}');

select pg_temp.assert((select count(*) from public.profiles) = 2, 'profiles provisioned for new users');
select pg_temp.assert(
  (select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Avery',
  'first name derived from auth metadata');
select pg_temp.assert(
  (select daily_reminder from public.notification_preferences
     where user_id = '00000000-0000-0000-0000-00000000000a') = 'off',
  'default notification preferences are low-frequency');

insert into public.universities (id, name, search_name, domains, primary_domain, country, country_code, source, source_id) values
  ('10000000-0000-0000-0000-000000000001', 'San Diego State University', 'san diego state university', '{sdsu.edu}', 'sdsu.edu', 'United States', 'US', 'test', '1'),
  ('10000000-0000-0000-0000-000000000002', 'University of San Diego', 'university of san diego', '{sandiego.edu}', 'sandiego.edu', 'United States', 'US', 'test', '2'),
  ('10000000-0000-0000-0000-000000000003', 'Universidad de Buenos Aires', 'universidad de buenos aires', '{uba.ar}', 'uba.ar', 'Argentina', 'AR', 'test', '3');

-- ---------------------------------------------------------------------------
-- User A creates data
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

update public.profiles set user_type = 'college_student', timezone = 'America/Los_Angeles'
  where id = '00000000-0000-0000-0000-00000000000a';

insert into public.education_profiles (id, user_id, university_id, level, year_in_school)
values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
        '10000000-0000-0000-0000-000000000001', 'undergraduate', 'junior');

insert into public.user_majors (user_id, education_profile_id, name, kind) values
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'Artificial Intelligence', 'major'),
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'Data Science', 'minor');

insert into public.roadmaps (id, user_id, title) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Path to AI product management');

insert into public.roadmap_milestones (id, roadmap_id, user_id, horizon, title) values
  ('40000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000a', 'term', 'Build one product case study');

insert into public.daily_actions (user_id, action_date, title, why, category, estimated_minutes, status, milestone_id)
values
  ('00000000-0000-0000-0000-00000000000a', current_date, 'Outline a case study', 'Builds evidence', 'experience', 20, 'completed', '40000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000a', current_date - 1, 'Save two internships', 'Applications', 'applications', 10, 'completed', null),
  ('00000000-0000-0000-0000-00000000000a', current_date - 2, 'Read about RAG', 'Learning', 'learning', 15, 'skipped', null);

select pg_temp.assert(
  (public.get_progress_summary() ->> 'total_completed')::int = 2, 'progress counts completed actions');
select pg_temp.assert(
  (public.get_progress_summary() -> 'by_category' ->> 'experience')::int = 1, 'progress by category');
select pg_temp.assert(
  (public.get_progress_summary() ->> 'active_days_last_7')::int = 2, 'active days counts distinct days');

-- One live primary action per day
select pg_temp.expect_error($sql$
  insert into public.daily_actions (user_id, action_date, title, why, category, estimated_minutes)
  values ('00000000-0000-0000-0000-00000000000a', current_date, 'Second', 'x', 'learning', 5)
$sql$, '23505', 'only one primary action per day');

-- One active roadmap per kind
select pg_temp.expect_error($sql$
  insert into public.roadmaps (user_id, title) values ('00000000-0000-0000-0000-00000000000a', 'Another')
$sql$, '23505', 'only one active career roadmap');

-- Catalogs are read-only for users
select pg_temp.assert((select count(*) from public.universities) = 3, 'authenticated can read universities');
select pg_temp.expect_error($sql$
  insert into public.universities (name, search_name, source) values ('Fake U', 'fake u', 'user')
$sql$, '42501', 'authenticated cannot write universities');

-- University search
select pg_temp.assert(
  (select name from public.search_universities('san diego state') limit 1) = 'San Diego State University',
  'search ranks exact prefix first');
select pg_temp.assert(
  (select count(*) from public.search_universities('sdsu')) >= 1, 'search matches domains');
select pg_temp.assert(
  (select count(*) from public.search_universities('diego', 'AR')) = 0, 'search filters by country');
select pg_temp.assert(
  (select count(*) from public.search_universities('buenos')) = 1, 'search matches non-US schools');
select pg_temp.assert(
  (select count(*) from public.search_universities('%%')) = 0, 'wildcards are escaped');

-- ---------------------------------------------------------------------------
-- User B cannot see or touch A's data
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

select pg_temp.assert((select count(*) from public.profiles) = 1, 'B sees only own profile');
select pg_temp.assert((select count(*) from public.education_profiles) = 0, 'B cannot read A education');
select pg_temp.assert((select count(*) from public.user_majors) = 0, 'B cannot read A majors');
select pg_temp.assert((select count(*) from public.roadmaps) = 0, 'B cannot read A roadmap');
select pg_temp.assert((select count(*) from public.daily_actions) = 0, 'B cannot read A actions');
select pg_temp.assert((select count(*) from public.notification_preferences) = 1, 'B sees own prefs only');
select pg_temp.assert(
  (public.get_progress_summary() ->> 'total_completed')::int = 0, 'B progress is isolated');

with u as (
  update public.roadmaps set title = 'hijacked' where id = '30000000-0000-0000-0000-00000000000a' returning 1
) select pg_temp.assert((select count(*) from u) = 0, 'B cannot update A roadmap');

with d as (
  delete from public.daily_actions where user_id = '00000000-0000-0000-0000-00000000000a' returning 1
) select pg_temp.assert((select count(*) from d) = 0, 'B cannot delete A actions');

select pg_temp.expect_error($sql$
  insert into public.user_goals (user_id, title) values ('00000000-0000-0000-0000-00000000000a', 'x')
$sql$, '42501', 'B cannot insert rows owned by A');

-- Composite FKs: B cannot attach own rows to A's parents
select pg_temp.expect_error($sql$
  insert into public.user_majors (user_id, education_profile_id, name, kind)
  values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000a', 'X', 'major')
$sql$, '23503', 'B cannot link a major to A education profile');

select pg_temp.expect_error($sql$
  insert into public.roadmap_milestones (roadmap_id, user_id, horizon, title)
  values ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'week', 'X')
$sql$, '23503', 'B cannot add milestones to A roadmap');

select pg_temp.expect_error($sql$
  update public.profiles set id = '00000000-0000-0000-0000-00000000000a'
  where id = '00000000-0000-0000-0000-00000000000b'
$sql$, '42501', 'B cannot re-point own profile to A');

-- ---------------------------------------------------------------------------
-- Anonymous users see nothing
-- ---------------------------------------------------------------------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error('select * from public.profiles', '42501', 'anon cannot read profiles');
select pg_temp.expect_error('select * from public.universities', '42501', 'anon cannot read catalogs');

reset role;

-- Deleting the auth user removes everything they own
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.assert(
  (select count(*) from public.daily_actions) = 0 and (select count(*) from public.roadmaps) = 0,
  'user deletion cascades');

\o
\echo '  ✓ RLS and integrity tests passed'
