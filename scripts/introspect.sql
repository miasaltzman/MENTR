-- Emits a JSON description of the public schema for scripts/gen-db-types.ts.
\pset tuples_only on
\pset format unaligned
select jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', t.typname,
          'typtype', t.typtype,
          'elem', et.typname,
          'elemtyptype', et.typtype,
          'nullable', not a.attnotnull,
          'hasDefault', a.atthasdef or a.attidentity <> '',
          'generated', a.attgenerated <> ''
        ) order by a.attnum)
        from pg_attribute a
        join pg_type t on t.oid = a.atttypid
        left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'relationships', coalesce((
        select jsonb_agg(jsonb_build_object(
          'foreignKeyName', con.conname,
          'columns', (select jsonb_agg(att.attname order by k.ord) from unnest(con.conkey) with ordinality k(n, ord)
                        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.n),
          'isOneToOne', false,
          'referencedRelation', rc.relname,
          'referencedColumns', (select jsonb_agg(att.attname order by k.ord) from unnest(con.confkey) with ordinality k(n, ord)
                        join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.n)
        ) order by con.conname)
        from pg_constraint con
        join pg_class rc on rc.oid = con.confrelid
        join pg_namespace rn on rn.oid = rc.relnamespace and rn.nspname = 'public'
        where con.conrelid = c.oid and con.contype = 'f'
      ), '[]'::jsonb)
    ) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'enums', (
    select jsonb_object_agg(t.typname, (
      select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', p.proargnames[i],
          'type', format_type(p.proargtypes[i - 1], null),
          'optional', i > p.pronargs - p.pronargdefaults
        ) order by i)
        from generate_series(1, p.pronargs) i
      ), '[]'::jsonb),
      'returns', format_type(p.prorettype, null),
      'retset', p.proretset
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('authenticated', p.oid, 'execute')
      and format_type(p.prorettype, null) not in ('trigger', 'void')
  )
);
