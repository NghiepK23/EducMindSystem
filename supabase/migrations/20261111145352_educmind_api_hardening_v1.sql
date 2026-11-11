-- Siết quyền truy cập qua API. Không xóa đối tượng nào; chỉ thu bớt quyền không cần dùng.

-- 1) Người chưa đăng nhập (anon) không dùng bảng hay hàm nào của ứng dụng: mọi chính sách RLS đều dành cho
--    authenticated. Trước đây anon vẫn có quyền mặc định trên bảng và gọi được mọi hàm qua quyền PUBLIC.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public,anon;

-- 2) Người đã đăng nhập: bỏ quyền không bao giờ cần qua API (TRUNCATE không chịu RLS).
revoke truncate,references,trigger on all tables in schema public from authenticated;

-- 3) Bảng do máy chủ tự ghi: người dùng chỉ đọc. Riêng gợi ý và thông báo được sửa đúng hai cột phản hồi,
--    nên học sinh không sửa được nội dung gợi ý hay thông báo của mình.
revoke insert,update,delete on public.learning_evidence,public.mastery,public.knowledge_gaps from authenticated;
revoke insert,update,delete on public.recommendations,public.notifications from authenticated;
grant update(status,responded_at) on public.recommendations to authenticated;
grant update(is_read,read_at) on public.notifications to authenticated;

-- 4) Hàm chỉ chạy trong trigger: không ai cần gọi trực tiếp (trigger vẫn chạy bình thường).
revoke execute on function
  public.auth_user_profile(),
  public.guard_assessment_answer_window(),
  public.guard_student_attempt_start(),
  public.guard_student_submission_state(),
  public.protect_student_grades(),
  public.validate_assignment_submission_bounds(),
  public.validate_rubric_score_bound()
from authenticated;

-- 5) Hàm dùng trong chính sách RLS và các RPC của ứng dụng: chỉ người đã đăng nhập.
grant execute on function
  public.can_access_class(uuid),
  public.can_access_course(uuid),
  public.can_manage_assessment(uuid),
  public.can_manage_assignment(uuid),
  public.can_manage_class(uuid),
  public.can_manage_course(uuid),
  public.can_read_resource(text),
  public.current_app_role(),
  public.student_can_submit(uuid),
  public.student_can_take(uuid),
  public.student_content(uuid,uuid,uuid),
  public.create_class_with_code(text,smallint,text),
  public.join_class_with_code(text),
  public.student_assessment_questions(uuid)
to authenticated;

-- 6) Cột updated_at được máy chủ cập nhật mỗi lần sửa.
create function public.set_updated_at() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger educmind_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger educmind_set_updated_at before update on public.classes for each row execute function public.set_updated_at();
create trigger educmind_set_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger educmind_set_updated_at before update on public.rubric_scores for each row execute function public.set_updated_at();

-- 7) Học sinh xem được hồ sơ (tên, email) của giáo viên chủ nhiệm các lớp mình tham gia.
create policy profile_class_teacher_read on public.profiles for select to authenticated
  using (exists(
    select 1 from public.classes c
    join public.class_members m on m.class_id=c.id
    where c.owner_teacher_id=profiles.id and m.student_id=auth.uid() and c.deleted_at is null));

-- 8) Giáo viên thêm học sinh đã có tài khoản vào lớp bằng email.
--    Trả về: ADDED | ALREADY_MEMBER | NOT_FOUND | NOT_A_STUDENT.
create function public.add_student_by_email(p_class uuid,p_email text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid;
  v_role public.app_role;
begin
  if not public.can_manage_class(p_class) then raise exception 'Class not found'; end if;
  select p.id,p.role into v_id,v_role from public.profiles p where lower(p.email)=lower(btrim(p_email));
  if v_id is null then return 'NOT_FOUND'; end if;
  if v_role<>'STUDENT' then return 'NOT_A_STUDENT'; end if;
  insert into public.class_members(class_id,student_id) values(p_class,v_id) on conflict do nothing;
  if not found then return 'ALREADY_MEMBER'; end if;
  return 'ADDED';
end $$;

revoke all on function public.set_updated_at() from public,anon,authenticated;
revoke all on function public.add_student_by_email(uuid,text) from public,anon;
grant execute on function public.add_student_by_email(uuid,text) to authenticated;
