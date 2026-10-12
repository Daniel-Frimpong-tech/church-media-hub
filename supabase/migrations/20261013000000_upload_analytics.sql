-- Dashboard analytics.
--
-- Counting in the database keeps the dashboard fast and correct however many
-- uploads there are (the API returns at most 1,000 rows per request, so
-- counting in the app would quietly go wrong past that).
--
-- "security invoker" means it runs as the person asking, so Row Level Security
-- still applies: a viewer's numbers only cover the categories their team gets.

create function public.upload_analytics(p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with finished as (
    select u.category_id, u.uploaded_by, u.size_bytes, u.completed_at, u.mime_type
    from public.uploads u
    where u.status = 'complete'
  ),
  recent as (
    select * from finished where completed_at >= p_since
  )
  select jsonb_build_object(
    'total_files', (select count(*) from finished),
    'total_bytes', (select coalesce(sum(size_bytes), 0) from finished),
    'last_30_days', (
      select count(*) from finished where completed_at >= now() - interval '30 days'
    ),
    'previous_30_days', (
      select count(*) from finished
      where completed_at >= now() - interval '60 days'
        and completed_at < now() - interval '30 days'
    ),
    -- Weeks start on Sunday in the church's time zone, so a week is one
    -- Sunday service and everything uploaded after it.
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'files', w.files) order by w.week), '[]'::jsonb)
      from (
        select to_char(
                 date_trunc('week', (completed_at at time zone 'America/Los_Angeles') + interval '1 day')
                   - interval '1 day',
                 'YYYY-MM-DD'
               ) as week,
               count(*) as files
        from recent
        group by 1
      ) w
    ),
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'files', c.files) order by c.files desc, c.name), '[]'::jsonb)
      from (
        select cat.name, count(*) as files
        from recent r
        join public.categories cat on cat.id = r.category_id
        group by cat.name
      ) c
    ),
    'by_person', (
      select coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'files', p.files) order by p.files desc, p.full_name), '[]'::jsonb)
      from (
        select prof.full_name, count(*) as files
        from recent r
        join public.profiles prof on prof.id = r.uploaded_by
        group by prof.full_name
        order by count(*) desc
        limit 6
      ) p
    ),
    'videos', (select count(*) from recent where mime_type like 'video/%'),
    'photos', (select count(*) from recent where mime_type not like 'video/%')
  )
$$;

revoke all on function public.upload_analytics(timestamptz) from public, anon;
grant execute on function public.upload_analytics(timestamptz) to authenticated;
