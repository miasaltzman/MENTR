-- Rank an exact domain-label match first, so acronyms like "mit" or "ucla"
-- find the school whose domain is mit.edu / ucla.edu before name prefixes.
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
    (exists (select 1 from unnest(u.domains) d where split_part(d, '.', 1) = q.term)) desc,
    (u.search_name like q.pat || '%') desc,
    (exists (select 1 from unnest(u.domains) d where d like q.pat || '%')) desc,
    word_similarity(q.term, u.search_name) desc,
    char_length(u.name) asc
  limit least(greatest(p_limit, 1), 25);
$$;
