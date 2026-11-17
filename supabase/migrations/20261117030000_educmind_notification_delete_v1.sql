drop policy if exists notification_delete on public.notifications;
create policy notification_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

grant delete on public.notifications to authenticated;
