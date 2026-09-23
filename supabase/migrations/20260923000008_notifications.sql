-- Notification preferences. Defaults are deliberately low-frequency.

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  daily_reminder public.daily_reminder_frequency not null default 'off',
  daily_reminder_time time not null default '09:00',
  opportunity_alerts public.opportunity_alert_level not null default 'important',
  industry_updates public.industry_update_frequency not null default 'weekly_digest',
  weekly_checkin boolean not null default true,
  -- ISO day of week (1 = Monday ... 7 = Sunday)
  weekly_checkin_day smallint not null default 7 check (weekly_checkin_day between 1 and 7),
  channel_email boolean not null default true,
  channel_push boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.notification_preferences');

-- Every new profile gets default preferences.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_profile() from public, anon, authenticated;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();
