-- Shared reference data: universities, majors, campus resources, careers,
-- skills, and learning resources. Populated by import scripts / ingestion
-- jobs (service_role), never hardcoded in the frontend.

-- ---------------------------------------------------------------------------
-- Universities (worldwide; seeded from an open dataset, enriched over time)
-- ---------------------------------------------------------------------------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Lowercased, accent-stripped name used for trigram search.
  search_name text not null,
  domains text[] not null default '{}',
  primary_domain text,
  country text,
  country_code text check (country_code is null or char_length(country_code) = 2),
  state_region text,
  city text,
  latitude double precision,
  longitude double precision,
  website_url text,
  -- Quick links. Only filled from verified university_resources.
  career_center_url text,
  clubs_directory_url text,
  career_portal_url text,
  entrepreneurship_url text,
  academic_advising_url text,
  alumni_url text,
  source text not null,
  source_id text,
  metadata jsonb not null default '{}',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index universities_search_name_trgm
  on public.universities using gin (search_name extensions.gin_trgm_ops);
create index universities_domains_gin on public.universities using gin (domains);
create index universities_country_code on public.universities (country_code);

create trigger universities_updated_at before update on public.universities
  for each row execute function public.set_updated_at();

select public.apply_catalog_rls('public.universities');

-- Ranked search: prefix and word matches first, then fuzzy similarity.
create or replace function public.search_universities(
  p_query text,
  p_country_code text default null,
  p_limit integer default 10
)
returns setof public.universities
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select
      lower(trim(p_query)) as term,
      -- Escape LIKE metacharacters in user input.
      replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') as pat
  )
  select u.*
  from public.universities u, q
  where char_length(q.term) >= 2
    and (p_country_code is null or u.country_code = upper(p_country_code))
    and (
      u.search_name like '%' || q.pat || '%'
      or q.term <% u.search_name
      or exists (select 1 from unnest(u.domains) d where d like q.pat || '%')
    )
  order by
    (u.search_name like q.pat || '%') desc,
    (exists (select 1 from unnest(u.domains) d where d like q.pat || '%')) desc,
    word_similarity(q.term, u.search_name) desc,
    char_length(u.name) asc
  limit least(greatest(p_limit, 1), 25);
$$;

grant execute on function public.search_universities(text, text, integer) to authenticated;
revoke execute on function public.search_universities(text, text, integer) from anon;

-- ---------------------------------------------------------------------------
-- Majors (university_id null = global catalog entry)
-- ---------------------------------------------------------------------------
create table public.majors (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities (id) on delete cascade,
  name text not null,
  department text,
  degree_type text,
  cip_code text,
  source text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (university_id, name, degree_type)
);

create index majors_university on public.majors (university_id);

select public.apply_catalog_rls('public.majors');

-- ---------------------------------------------------------------------------
-- University resources (career center, advising, etc.) with provenance.
-- ---------------------------------------------------------------------------
create table public.university_resources (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  type public.university_resource_type not null,
  name text not null,
  description text,
  url text not null check (url ~* '^https?://'),
  source_url text,
  source_name text,
  verification_status public.verification_status not null default 'unverified',
  retrieved_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, url)
);

create index university_resources_university on public.university_resources (university_id, type);

create trigger university_resources_updated_at before update on public.university_resources
  for each row execute function public.set_updated_at();

select public.apply_catalog_rls('public.university_resources');

-- ---------------------------------------------------------------------------
-- Career paths catalog (content filled from O*NET / ESCO / curated sources).
-- ---------------------------------------------------------------------------
create table public.career_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text,
  category text,
  onet_code text,
  esco_uri text,
  content jsonb not null default '{}',
  sources jsonb not null default '[]',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger career_paths_updated_at before update on public.career_paths
  for each row execute function public.set_updated_at();

select public.apply_catalog_rls('public.career_paths');

-- ---------------------------------------------------------------------------
-- Skills catalog
-- ---------------------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.skill_category not null,
  esco_uri text,
  created_at timestamptz not null default now()
);

create unique index skills_name_unique on public.skills (lower(name));

select public.apply_catalog_rls('public.skills');

-- ---------------------------------------------------------------------------
-- Learning resources (courses, books, videos...) — always from real sources.
-- ---------------------------------------------------------------------------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  kind public.resource_kind not null,
  title text not null,
  description text,
  url text not null check (url ~* '^https?://'),
  author text,
  provider text,
  topics text[] not null default '{}',
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  cost text check (cost is null or cost in ('free', 'paid', 'freemium')),
  source_name text not null,
  source_url text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  last_verified_at timestamptz,
  verification_status public.verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create index resources_topics_gin on public.resources using gin (topics);

create trigger resources_updated_at before update on public.resources
  for each row execute function public.set_updated_at();

select public.apply_catalog_rls('public.resources');
