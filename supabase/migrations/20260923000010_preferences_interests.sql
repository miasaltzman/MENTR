-- Topics the user enjoys (distinct from career interests and industries).
alter table public.user_preferences
  add column interests text[] not null default '{}';
