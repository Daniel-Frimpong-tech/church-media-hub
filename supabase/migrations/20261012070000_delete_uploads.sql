-- Deleting uploads.
--
-- Admins can remove an upload (a mistake, or test data). When the last file in
-- a category goes, a handoff that was "ready" only because of that file should
-- stop being ready, so the same check that runs when a file arrives now also
-- runs when one is removed.

create function private.on_upload_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip when the whole service is being deleted: its handoffs go with it.
  if exists (select 1 from public.services where id = old.service_id) then
    perform private.refresh_handoff_ready(old.service_id, old.category_id);
  end if;
  return null;
end;
$$;

create trigger upload_deleted_ready
  after delete on public.uploads
  for each row
  when (old.status = 'complete')
  execute function private.on_upload_deleted();

revoke all on function private.on_upload_deleted() from public, anon;
