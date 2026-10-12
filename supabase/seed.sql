-- Sample data for a local Supabase (`npx supabase start` / `npx supabase db reset`).
-- It is never applied to the hosted project: `supabase db push` ignores this file.
--
-- It sets up a small, believable media team in the middle of a normal week:
-- last Sunday's service partly delivered, next Sunday's already planned.
-- Categories and duty roles come from the migrations.

-- ── Teams ───────────────────────────────────────────────────────────────────

insert into public.teams (id, name, kind) values
  ('10000000-0000-4000-8000-000000000001', 'Media', 'media'),
  ('10000000-0000-4000-8000-000000000002', 'Thumbnails', 'receiving'),
  ('10000000-0000-4000-8000-000000000003', 'Social Media', 'receiving'),
  ('10000000-0000-4000-8000-000000000004', 'Website', 'receiving');

-- ── People ──────────────────────────────────────────────────────────────────
-- Sign-up is invite only, so each person is invited and then "signs up". The
-- invite trigger creates their profile with the invited role and team.
-- These accounts have no password: they exist to populate screens, not to
-- sign in with.

insert into public.invites (email, role, team_id) values
  ('ama.owusu@example.com', 'admin', '10000000-0000-4000-8000-000000000001'),
  ('grace.mensah@example.com', 'member', '10000000-0000-4000-8000-000000000001'),
  ('sam.boateng@example.com', 'member', '10000000-0000-4000-8000-000000000001'),
  ('kofi.asante@example.com', 'member', '10000000-0000-4000-8000-000000000001'),
  ('tola.adeyemi@example.com', 'viewer', '10000000-0000-4000-8000-000000000002'),
  ('ada.nwosu@example.com', 'viewer', '10000000-0000-4000-8000-000000000003'),
  -- Invited but has not signed in yet.
  ('new.volunteer@example.com', 'member', null);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  person.id, '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', person.email, '', now(),
  '{"provider": "google", "providers": ["google"]}'::jsonb,
  jsonb_build_object('full_name', person.full_name),
  now(), now(), '', '', '', ''
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid, 'ama.owusu@example.com', 'Ama Owusu'),
  ('20000000-0000-4000-8000-000000000002'::uuid, 'grace.mensah@example.com', 'Grace Mensah'),
  ('20000000-0000-4000-8000-000000000003'::uuid, 'sam.boateng@example.com', 'Sam Boateng'),
  ('20000000-0000-4000-8000-000000000004'::uuid, 'kofi.asante@example.com', 'Kofi Asante'),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'tola.adeyemi@example.com', 'Tola Adeyemi'),
  ('20000000-0000-4000-8000-000000000006'::uuid, 'ada.nwosu@example.com', 'Ada Nwosu')
) as person (id, email, full_name);

-- ── Who receives what, and by when ──────────────────────────────────────────

insert into public.category_teams (category_id, team_id, deadline_hours)
select c.id, mapping.team_id, mapping.deadline_hours
from (values
  ('preacher', '10000000-0000-4000-8000-000000000002'::uuid, 24),
  ('baptism', '10000000-0000-4000-8000-000000000003'::uuid, 48),
  ('fellowship', '10000000-0000-4000-8000-000000000003'::uuid, 48),
  ('videos', '10000000-0000-4000-8000-000000000004'::uuid, 72)
) as mapping (slug, team_id, deadline_hours)
join public.categories c on c.slug = mapping.slug;

-- ── Services ────────────────────────────────────────────────────────────────
-- Times are 10:00 on Sunday and 19:30 on Wednesday, Pacific time, worked out
-- from "now" so the data always looks current.

insert into public.service_series (id, name, weekday, local_time) values
  ('30000000-0000-4000-8000-000000000001', 'Sunday Service', 0, '10:00'),
  ('30000000-0000-4000-8000-000000000002', 'Midweek Prayer', 3, '19:30');

with this_week as (
  -- Monday 00:00 of the current week, on the church's clock.
  select date_trunc('week', now() at time zone 'America/Los_Angeles') as monday
)
insert into public.services (id, name, starts_at, series_id, series_slot, created_by)
select s.id, s.name, s.local_start at time zone 'America/Los_Angeles',
       s.series_id, s.local_start at time zone 'America/Los_Angeles',
       '20000000-0000-4000-8000-000000000001'
from this_week,
lateral (values
  ('40000000-0000-4000-8000-000000000001'::uuid, 'Sunday Service',
    monday - interval '1 day' + interval '10 hours',
    '30000000-0000-4000-8000-000000000001'::uuid),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'Midweek Prayer',
    monday + interval '2 days 19 hours 30 minutes',
    '30000000-0000-4000-8000-000000000002'::uuid),
  ('40000000-0000-4000-8000-000000000003'::uuid, 'Sunday Service',
    monday + interval '6 days 10 hours',
    '30000000-0000-4000-8000-000000000001'::uuid)
) as s (id, name, local_start, series_id);

-- ── Assignments ─────────────────────────────────────────────────────────────

insert into public.assignments (id, service_id, profile_id, duty_role_id)
select a.id, a.service_id, a.profile_id, r.id
from (values
  -- Last Sunday.
  ('50000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid, 'Photographer'),
  ('50000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000003'::uuid, 'Videographer'),
  ('50000000-0000-4000-8000-000000000003'::uuid, '40000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000004'::uuid, 'Photographer'),
  -- Next Sunday.
  ('50000000-0000-4000-8000-000000000004'::uuid, '40000000-0000-4000-8000-000000000003'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid, 'Photographer'),
  ('50000000-0000-4000-8000-000000000005'::uuid, '40000000-0000-4000-8000-000000000003'::uuid,
    '20000000-0000-4000-8000-000000000003'::uuid, 'Videographer')
) as a (id, service_id, profile_id, duty_role)
join public.duty_roles r on r.name = a.duty_role;

insert into public.assignment_categories (assignment_id, category_id)
select t.assignment_id, c.id
from (values
  ('50000000-0000-4000-8000-000000000001'::uuid, 'preacher'),
  ('50000000-0000-4000-8000-000000000001'::uuid, 'baptism'),
  ('50000000-0000-4000-8000-000000000002'::uuid, 'videos'),
  ('50000000-0000-4000-8000-000000000003'::uuid, 'fellowship'),
  ('50000000-0000-4000-8000-000000000004'::uuid, 'preacher'),
  ('50000000-0000-4000-8000-000000000004'::uuid, 'fellowship'),
  ('50000000-0000-4000-8000-000000000005'::uuid, 'videos')
) as t (assignment_id, slug)
join public.categories c on c.slug = t.slug;

-- ── Last Sunday's uploads ───────────────────────────────────────────────────
-- Grace uploaded preacher and baptism photos; Sam uploaded the sermon video.
-- Kofi has not uploaded fellowship yet. The Drive IDs are made up, so these
-- show as tiles without a preview.

insert into public.uploads (
  service_id, category_id, uploaded_by, drive_file_id, file_name, mime_type,
  size_bytes, status, completed_at
)
select '40000000-0000-4000-8000-000000000001', c.id, u.uploaded_by,
       'seed-drive-file-' || u.n, u.file_name, u.mime_type, u.size_bytes,
       'complete', now() - interval '1 hour' * (10 - u.n)
from (values
  (1, 'preacher', '20000000-0000-4000-8000-000000000002'::uuid, 'IMG_4101.jpg', 'image/jpeg', 6291456),
  (2, 'preacher', '20000000-0000-4000-8000-000000000002'::uuid, 'IMG_4102.jpg', 'image/jpeg', 5872025),
  (3, 'preacher', '20000000-0000-4000-8000-000000000002'::uuid, 'IMG_4107.jpg', 'image/jpeg', 6710886),
  (4, 'baptism', '20000000-0000-4000-8000-000000000002'::uuid, 'IMG_4120.jpg', 'image/jpeg', 7025459),
  (5, 'baptism', '20000000-0000-4000-8000-000000000002'::uuid, 'IMG_4121.jpg', 'image/jpeg', 6501171),
  (6, 'videos', '20000000-0000-4000-8000-000000000003'::uuid, 'sermon-full.mp4', 'video/mp4', 1932735283)
) as u (n, slug, uploaded_by, file_name, mime_type, size_bytes)
join public.categories c on c.slug = u.slug;

-- Grace marked both her tasks done, which makes Preacher and Baptism ready for
-- their teams. Sam uploaded but has not marked done. Kofi has done neither.
update public.assignment_categories set done_at = now() - interval '5 hours'
where assignment_id = '50000000-0000-4000-8000-000000000001';

-- The thumbnail team has confirmed they have the preacher photos.
update public.handoffs
set received_at = now() - interval '2 hours',
    received_by = '20000000-0000-4000-8000-000000000005'
where service_id = '40000000-0000-4000-8000-000000000001'
  and team_id = '10000000-0000-4000-8000-000000000002';
