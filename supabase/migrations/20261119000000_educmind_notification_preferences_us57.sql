-- EducMind · US-57: bật/tắt từng loại thông báo, riêng cho từng tài khoản.
-- CHỈ nhóm trưởng / người quản lý Supabase mới triển khai migration này,
-- trước tiên trên môi trường thử nghiệm. KHÔNG chạy trực tiếp trên DB chung khi chưa duyệt.

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type)
);

alter table public.notification_preferences enable row level security;

create policy notification_prefs_select_own
on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy notification_prefs_insert_own
on public.notification_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

create policy notification_prefs_update_own
on public.notification_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update on public.notification_preferences to authenticated;

-- Mọi đường tạo thông báo (trigger / hàm SQL) cùng đi qua bảng public.notifications.
-- Ngăn INSERT khi chủ tài khoản đã tắt loại thông báo tương ứng.
-- Ngăn UPDATE nội dung của thông báo gộp sau khi người dùng tắt loại đó.
-- Thao tác đánh dấu đã đọc (chỉ sửa is_read/read_at) vẫn thực hiện được.
create or replace function public.enforce_notification_preferences()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is null or new.type is null then
    return new;
  end if;
  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id
      and p.notification_type = new.type
      and p.enabled = false
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger educmind_notification_preferences_guard
before insert or update of title, content, payload, created_at on public.notifications
for each row execute function public.enforce_notification_preferences();

revoke all on function public.enforce_notification_preferences() from public, anon, authenticated;
