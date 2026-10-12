-- Sample data for local development (`npx supabase db reset`).
-- This file is never applied to the hosted project.

insert into public.teams (name, kind) values
  ('Media', 'media'),
  ('Thumbnails', 'receiving'),
  ('Social Media', 'receiving'),
  ('Website', 'receiving');

-- People appear once they sign in, so sample people are seeded as invites.
insert into public.invites (email, role, team_id) values
  ('admin@example.com', 'admin', null),
  ('grace.photographer@example.com', 'member',
    (select id from public.teams where name = 'Media')),
  ('sam.videographer@example.com', 'member',
    (select id from public.teams where name = 'Media')),
  ('tola.thumbnails@example.com', 'viewer',
    (select id from public.teams where name = 'Thumbnails')),
  ('ada.social@example.com', 'viewer',
    (select id from public.teams where name = 'Social Media'));
