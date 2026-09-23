-- Local development seed: the Mentr demo persona.
--
-- Creates demo@mentr.local (sign in with a magic link; local Supabase shows
-- the email in Inbucket at http://localhost:54324). Core onboarding answers
-- are pre-filled, so the first sign-in lands on "Build my plan" and the app
-- generates the roadmap exactly as it would for a real user.
--
-- This is development data only. Nothing in the product special-cases this
-- persona or its university.

-- The university normally comes from `npm run db:import-universities`.
insert into public.universities (name, search_name, domains, primary_domain, country, country_code, website_url, source, source_id)
values ('San Diego State University', 'san diego state university', '{sdsu.edu}', 'sdsu.edu', 'United States', 'US', 'http://www.sdsu.edu/', 'hipo-university-domains', 'US:san diego state university')
on conflict (source, source_id) do nothing;

do $$
declare
  v_user uuid := '0d5e6f00-0000-4000-8000-00000000d3e0';
  v_uni uuid;
  v_edu uuid;
begin
  if exists (select 1 from auth.users where id = v_user) then
    raise notice 'Demo user already exists; skipping.';
    return;
  end if;

  select id into v_uni from public.universities
  where source = 'hipo-university-domains' and source_id = 'US:san diego state university';

  -- GoTrue expects its token columns to be empty strings, not NULL.
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo@mentr.local', now(),
          '{"provider":"email","providers":["email"]}', '{"full_name":"Mia"}', '', '', '', '', now(), now())
  on conflict (id) do nothing;

  -- Newer GoTrue versions require an identity row for email sign-in.
  if to_regclass('auth.identities') is not null then
    execute $sql$
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
      values ($1, $1, $1::text, 'email', jsonb_build_object('sub', $1::text, 'email', 'demo@mentr.local', 'email_verified', true), now(), now(), now())
      on conflict do nothing
    $sql$ using v_user;
  end if;

  -- Profile row is created by the on_auth_user_created trigger.
  update public.profiles set
    first_name = 'Mia',
    display_name = 'Mia',
    user_type = 'college_student',
    onboarding_status = 'in_progress',
    onboarding_step = 'goals',
    timezone = 'America/Los_Angeles',
    current_city = 'San Diego, CA',
    relocation_preference = 'open',
    preferred_locations = '{"San Francisco Bay Area",Seattle}',
    open_to_remote = true,
    career_certainty = 'kind_of'
  where id = v_user;

  insert into public.education_profiles (user_id, university_id, level, year_in_school, expected_graduation)
  values (v_user, v_uni, 'undergraduate', 'junior', '2028-05-01')
  returning id into v_edu;

  insert into public.user_majors (user_id, education_profile_id, name, kind, position) values
    (v_user, v_edu, 'Artificial Intelligence', 'major', 0),
    (v_user, v_edu, 'Data Science', 'minor', 1);

  insert into public.career_interests (user_id, label, certainty, position) values
    (v_user, 'AI Product Management', 'kind_of', 0),
    (v_user, 'AI Solutions Engineering', 'kind_of', 1),
    (v_user, 'Technology Entrepreneurship', 'kind_of', 2);

  insert into public.user_goals (user_id, title, horizon, origin, position) values
    (v_user, 'Secure a strong internship', 'year', 'onboarding', 0),
    (v_user, 'Understand the AI industry', 'year', 'onboarding', 1),
    (v_user, 'Build relevant experience', 'year', 'onboarding', 2),
    (v_user, 'Meet people working in AI', 'year', 'onboarding', 3),
    (v_user, 'Graduate with a clear career path', 'year', 'onboarding', 4);

  insert into public.user_skills (user_id, name, category, status, origin) values
    (v_user, 'Python', 'technical', 'current', 'onboarding'),
    (v_user, 'Machine learning fundamentals', 'technical', 'current', 'onboarding'),
    (v_user, 'Research', 'technical', 'current', 'onboarding'),
    (v_user, 'SQL', 'technical', 'target', 'onboarding'),
    (v_user, 'Product discovery', 'business', 'target', 'onboarding');

  insert into public.user_preferences (user_id, preferred_industries, skills_to_learn, lifestyle_priorities, five_year_vision, entrepreneurship_interest)
  values (v_user, '{"Artificial intelligence",Technology}', '{SQL,"Product discovery"}', '{"Meaningful impact","Fast growth"}',
          'Working as a product manager on AI products people actually use.', 'kind_of');

  -- Raw answers, so the profile page and onboarding resume show them.
  insert into public.onboarding_responses (user_id, question_key, answer) values
    (v_user, 'name', '{"value":"Mia"}'),
    (v_user, 'user_type', '{"value":"college_student"}'),
    (v_user, 'school', jsonb_build_object('id', v_uni, 'name', 'San Diego State University', 'location', 'United States')),
    (v_user, 'study', '{"major":"Artificial Intelligence","secondMajor":null,"minors":["Data Science"]}'),
    (v_user, 'year', '{"year":"junior","graduation":"2028-05"}'),
    (v_user, 'skills', '{"values":["Python","Machine learning fundamentals","Research"]}'),
    (v_user, 'career_certainty', '{"value":"kind_of"}'),
    (v_user, 'career_interests', '{"values":["AI Product Management","AI Solutions Engineering","Technology Entrepreneurship"]}'),
    (v_user, 'goals', '{"values":["Land an internship","Understand my industry","Build real experience","Meet people in my field","Graduate with a clear path"]}'),
    (v_user, 'vision', '{"value":"Working as a product manager on AI products people actually use."}'),
    (v_user, 'industries', '{"values":["Artificial intelligence","Technology"]}'),
    (v_user, 'location', '{"current":"San Diego, CA","relocation":"open","places":["San Francisco Bay Area","Seattle"]}'),
    (v_user, 'learn', '{"values":["SQL","Product discovery"]}')
  on conflict (user_id, question_key) do nothing;
end $$;
