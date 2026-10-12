-- Phase 5: who covers what at each service, and handing content to teams.

-- ── Tables ──────────────────────────────────────────────────────────────────

-- The jobs people do at a service. A table so admins can add more later.
create table public.duty_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0
);

insert into public.duty_roles (name, sort_order) values
  ('Photographer', 10),
  ('Videographer', 20),
  ('Editor', 30);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  duty_role_id uuid not null references public.duty_roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (service_id, profile_id, duty_role_id)
);

create index assignments_profile_id_idx on public.assignments (profile_id);

-- Which categories an assigned person is expected to upload, and whether they
-- have marked that task done.
create table public.assignment_categories (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  done_at timestamptz,
  primary key (assignment_id, category_id)
);

-- One row per service, category and receiving team. Its status (pending,
-- delivered, late) is worked out from these timestamps, never stored.
create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete cascade,
  due_at timestamptz not null,
  -- When the content became ready for the team.
  ready_at timestamptz,
  -- When the team confirmed they have it.
  received_at timestamptz,
  received_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (service_id, category_id, team_id)
);

create index handoffs_team_due_idx on public.handoffs (team_id, due_at);

-- ── Keeping handoffs in step ────────────────────────────────────────────────
-- Handoffs are created and updated by triggers, so they are right however a
-- service or mapping changes: from the app, a scheduled job, or by hand.

-- A category is ready for its teams when everyone assigned to it has marked
-- their task done. If nobody is assigned, it is ready once a file is uploaded.
create function private.refresh_handoff_ready(p_service_id uuid, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_count integer;
  done_count integer;
  is_ready boolean;
begin
  select count(*), count(ac.done_at)
    into task_count, done_count
  from public.assignment_categories ac
  join public.assignments a on a.id = ac.assignment_id
  where a.service_id = p_service_id and ac.category_id = p_category_id;

  if task_count > 0 then
    is_ready := done_count = task_count;
  else
    is_ready := exists (
      select 1 from public.uploads u
      where u.service_id = p_service_id
        and u.category_id = p_category_id
        and u.status = 'complete'
    );
  end if;

  if is_ready then
    update public.handoffs set ready_at = now()
    where service_id = p_service_id and category_id = p_category_id
      and ready_at is null;
  else
    -- Never un-ready something a team has already confirmed.
    update public.handoffs set ready_at = null
    where service_id = p_service_id and category_id = p_category_id
      and ready_at is not null and received_at is null;
  end if;
end;
$$;

-- New service: one handoff per mapped team for each active category.
create function private.on_service_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.handoffs (service_id, category_id, team_id, due_at)
  select new.id, ct.category_id, ct.team_id,
         new.starts_at + make_interval(hours => ct.deadline_hours)
  from public.category_teams ct
  join public.categories c on c.id = ct.category_id
  where c.is_active
  on conflict do nothing;
  return new;
end;
$$;

create trigger service_created_handoffs
  after insert on public.services
  for each row execute function private.on_service_created();

-- Service moved: deadlines move with it, unless already confirmed.
create function private.on_service_rescheduled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.handoffs h
  set due_at = new.starts_at + make_interval(hours => ct.deadline_hours)
  from public.category_teams ct
  where h.service_id = new.id
    and ct.category_id = h.category_id
    and ct.team_id = h.team_id
    and h.received_at is null;
  return new;
end;
$$;

create trigger service_rescheduled_handoffs
  after update of starts_at on public.services
  for each row
  when (old.starts_at is distinct from new.starts_at)
  execute function private.on_service_rescheduled();

-- Mapping changed: apply it to upcoming and recent services. Older services
-- keep the handoffs they had.
create function private.on_category_team_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.handoffs (service_id, category_id, team_id, due_at)
    select s.id, new.category_id, new.team_id,
           s.starts_at + make_interval(hours => new.deadline_hours)
    from public.services s
    where s.starts_at > now() - interval '14 days'
    on conflict do nothing;
    return new;
  elsif tg_op = 'UPDATE' then
    update public.handoffs h
    set due_at = s.starts_at + make_interval(hours => new.deadline_hours)
    from public.services s
    where s.id = h.service_id
      and h.category_id = new.category_id
      and h.team_id = new.team_id
      and h.received_at is null;
    return new;
  else
    delete from public.handoffs
    where category_id = old.category_id
      and team_id = old.team_id
      and received_at is null;
    return old;
  end if;
end;
$$;

create trigger category_team_changed_handoffs
  after insert or update of deadline_hours or delete on public.category_teams
  for each row execute function private.on_category_team_changed();

-- A new handoff starts with the right "ready" state.
create function private.on_handoff_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_handoff_ready(new.service_id, new.category_id);
  return new;
end;
$$;

create trigger handoff_created_ready
  after insert on public.handoffs
  for each row execute function private.on_handoff_created();

-- A task was added, removed, marked done or reopened.
create function private.on_task_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_assignment_id uuid;
  changed_category_id uuid;
  changed_service_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_assignment_id := old.assignment_id;
    changed_category_id := old.category_id;
  else
    changed_assignment_id := new.assignment_id;
    changed_category_id := new.category_id;
  end if;

  select service_id into changed_service_id
  from public.assignments where id = changed_assignment_id;

  -- Not found when the whole assignment is being deleted; that case is
  -- handled by on_assignment_deleted below.
  if found then
    perform private.refresh_handoff_ready(changed_service_id, changed_category_id);
  end if;
  return null;
end;
$$;

create trigger task_changed_ready
  after insert or update of done_at or delete on public.assignment_categories
  for each row execute function private.on_task_changed();

create function private.on_assignment_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected record;
begin
  for affected in
    select distinct category_id from public.handoffs where service_id = old.service_id
  loop
    perform private.refresh_handoff_ready(old.service_id, affected.category_id);
  end loop;
  return null;
end;
$$;

create trigger assignment_deleted_ready
  after delete on public.assignments
  for each row execute function private.on_assignment_deleted();

-- A file finished uploading.
create function private.on_upload_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_handoff_ready(new.service_id, new.category_id);
  return null;
end;
$$;

create trigger upload_completed_ready
  after update of status on public.uploads
  for each row
  when (new.status = 'complete' and old.status is distinct from new.status)
  execute function private.on_upload_completed();

-- ── Actions people take ─────────────────────────────────────────────────────
-- Exposed through the API. Each checks who is calling before changing anything,
-- so signed-in users need no direct write access to these columns.

-- An assigned person marks their own task done (or reopens it). Admins can do
-- it for anyone.
create function public.set_task_done(
  p_assignment_id uuid,
  p_category_id uuid,
  p_done boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.assignments a
    where a.id = p_assignment_id
      and (
        private.is_admin()
        or (
          a.profile_id = (select auth.uid())
          and private.current_app_role() in ('admin', 'member')
        )
      )
  ) then
    raise exception 'not_allowed';
  end if;

  update public.assignment_categories
  set done_at = case when p_done then coalesce(done_at, now()) else null end
  where assignment_id = p_assignment_id and category_id = p_category_id;

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- A receiving team confirms it has the content. Anyone on that team, or an
-- admin, may confirm. Only an admin may undo a confirmation.
create function public.set_handoff_received(p_handoff_id uuid, p_received boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.handoffs;
  caller_is_admin boolean := private.is_admin();
begin
  select * into target from public.handoffs where id = p_handoff_id;
  if not found then
    raise exception 'not_found';
  end if;

  if private.current_app_role() is null then
    raise exception 'not_allowed';
  end if;

  if not caller_is_admin and (
    not p_received
    or not exists (
      select 1 from public.team_members tm
      where tm.team_id = target.team_id and tm.profile_id = (select auth.uid())
    )
  ) then
    raise exception 'not_allowed';
  end if;

  if p_received then
    update public.handoffs
    set received_at = coalesce(received_at, now()),
        received_by = coalesce(received_by, (select auth.uid())),
        -- They have it, so it was ready, whatever the task list says.
        ready_at = coalesce(ready_at, now())
    where id = p_handoff_id;
  else
    update public.handoffs
    set received_at = null, received_by = null
    where id = p_handoff_id;
    perform private.refresh_handoff_ready(target.service_id, target.category_id);
  end if;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────────────────────

revoke all on public.duty_roles, public.assignments, public.assignment_categories,
  public.handoffs from anon, authenticated;

grant select, insert, update, delete
  on public.duty_roles, public.assignments, public.assignment_categories
  to authenticated;
-- Handoffs change only through triggers and set_handoff_received.
grant select on public.handoffs to authenticated;
grant all on public.handoffs, public.assignments, public.assignment_categories
  to service_role;

revoke all on all functions in schema private from public, anon;
grant execute on function private.current_app_role(), private.is_admin(),
  private.can_view_category(uuid) to authenticated;

revoke all on function public.set_task_done(uuid, uuid, boolean),
  public.set_handoff_received(uuid, boolean) from public, anon;
grant execute on function public.set_task_done(uuid, uuid, boolean),
  public.set_handoff_received(uuid, boolean) to authenticated;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.duty_roles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_categories enable row level security;
alter table public.handoffs enable row level security;

create policy "Active people can read duty roles"
  on public.duty_roles for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage duty roles"
  on public.duty_roles for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Active people can read assignments"
  on public.assignments for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage assignments"
  on public.assignments for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Active people can read assignment categories"
  on public.assignment_categories for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage assignment categories"
  on public.assignment_categories for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Admins and members see every handoff. Everyone else sees only their teams'.
create policy "People can read handoffs for their teams"
  on public.handoffs for select to authenticated
  using (
    (select private.current_app_role()) in ('admin', 'member')
    or (
      (select private.current_app_role()) is not null
      and exists (
        select 1 from public.team_members tm
        where tm.team_id = handoffs.team_id
          and tm.profile_id = (select auth.uid())
      )
    )
  );
