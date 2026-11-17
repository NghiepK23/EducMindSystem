alter table public.notifications
  add column if not exists deleted_at timestamptz;

drop policy if exists notification_delete on public.notifications;
revoke delete on public.notifications from authenticated;
grant update(deleted_at) on public.notifications to authenticated;
