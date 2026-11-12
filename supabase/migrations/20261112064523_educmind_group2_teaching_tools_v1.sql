-- Nhóm 2 — công cụ giảng dạy:
--   1) Ngân hàng câu hỏi theo khối/Bloom: thêm cột grade (khối 1–12) và bloom_level cho câu hỏi.
--   2) Mở bài học tuần tự: cột courses.sequential_unlock để giáo viên tự bật/tắt; điều kiện mở bài
--      (nắm vững ≥ 0.8 mọi mục tiêu của bài trước) do trình duyệt tính từ bảng mastery sẵn có.
--   3) Thêm lượt làm bù: bảng assessment_extra_attempts + nới giới hạn lượt trong protect_student_grades;
--      giáo viên cấp thêm lượt bằng RPC grant_extra_attempts.
--   4) Giáo viên tạo tài khoản học sinh: RPC create_student_account (mật khẩu ban đầu do giáo viên đặt,
--      email được xác nhận ngay, có thể thêm thẳng vào một lớp do mình quản lý).

alter table public.questions
  add column grade smallint check (grade between 1 and 12),
  add column bloom_level text check (bloom_level in ('REMEMBER','UNDERSTAND','APPLY','ANALYZE','EVALUATE','CREATE'));
create index if not exists questions_grade_idx on public.questions(grade);
create index if not exists questions_bloom_idx on public.questions(bloom_level);

alter table public.courses add column sequential_unlock boolean not null default false;

create table public.assessment_extra_attempts(
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  extra integer not null check(extra>=1),
  reason text not null default '',
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(assessment_id, student_id));
alter table public.assessment_extra_attempts enable row level security;
create policy attempt_extra_teacher_all on public.assessment_extra_attempts for all to authenticated
  using (exists(select 1 from public.assessments a where a.id=assessment_id and public.can_manage_course(a.course_id)))
  with check (exists(select 1 from public.assessments a where a.id=assessment_id and public.can_manage_course(a.course_id))
              and granted_by=auth.uid());
create policy attempt_extra_student_read on public.assessment_extra_attempts for select to authenticated
  using (student_id=auth.uid());
grant select,insert,update,delete on public.assessment_extra_attempts to authenticated;

-- Nới giới hạn số lượt làm: tổng số lượt đã làm không vượt max_attempts + lượt bù.
-- (Thân còn lại giữ nguyên như educmind_system_write_bypass_v1.)
create or replace function public.protect_student_grades() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_max integer; v_count integer; v_extra integer;
begin
  if public.educmind_is_system() then return new; end if;
  if auth.uid() is null or public.current_app_role()<>'STUDENT' then return new; end if;
  if tg_table_name='assessment_attempts' then
    if tg_op='INSERT' then
      if new.student_id<>auth.uid() then raise exception 'Attempt owner must be the signed-in student'; end if;
      select max_attempts into v_max from public.assessments
      where id=new.assessment_id and status='PUBLISHED' and deleted_at is null for update;
      if v_max is null then raise exception 'Assessment unavailable'; end if;
      select count(*) into v_count from public.assessment_attempts
      where assessment_id=new.assessment_id and student_id=auth.uid();
      select coalesce(sum(extra),0) into v_extra from public.assessment_extra_attempts
      where assessment_id=new.assessment_id and student_id=auth.uid();
      if v_count>=v_max+v_extra or new.attempt_number<>v_count+1 then
        raise exception 'Maximum attempts reached or attempt number invalid';
      end if;
      if new.status<>'IN_PROGRESS' or new.total_score is not null or new.graded_at is not null then
        raise exception 'Students can only start an ungraded attempt';
      end if;
      return new;
    end if;
    if new.total_score is distinct from old.total_score or new.graded_at is distinct from old.graded_at
       or new.student_id is distinct from old.student_id or new.assessment_id is distinct from old.assessment_id
       or new.attempt_number is distinct from old.attempt_number then
      raise exception 'Students cannot change grades or attempt ownership';
    end if;
  end if;
  if tg_table_name='submission_answers' then
    if tg_op='INSERT' then
      if new.score is not null or new.graded_by is not null or new.graded_at is not null or new.feedback<>'' then
        raise exception 'Students cannot submit grading fields';
      end if;
      return new;
    end if;
    if new.score is distinct from old.score or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by or new.graded_at is distinct from old.graded_at then
      raise exception 'Students cannot change grades';
    end if;
  end if;
  if tg_table_name='assignment_submissions' then
    if tg_op='INSERT' then
      if new.student_id<>auth.uid() or new.score is not null or new.feedback is not null
         or new.graded_by is not null or new.graded_at is not null then
        raise exception 'Students cannot submit grading fields or another student’s work';
      end if;
      return new;
    end if;
    if new.student_id is distinct from old.student_id or new.assignment_id is distinct from old.assignment_id
       or new.score is distinct from old.score or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by or new.graded_at is distinct from old.graded_at then
      raise exception 'Students cannot change grades or submission ownership';
    end if;
  end if;
  return new;
end $function$;

create function public.grant_extra_attempts(p_assessment uuid, p_student uuid, p_extra integer, p_reason text default '')
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_total integer;
begin
  if auth.uid() is null or public.current_app_role()<>'TEACHER' then
    raise exception 'Only teachers can grant extra attempts';
  end if;
  if not exists(select 1 from public.assessments a where a.id=p_assessment and public.can_manage_course(a.course_id)) then
    raise exception 'Bạn không quản lý bài kiểm tra này';
  end if;
  if p_extra is null or p_extra < 1 then
    raise exception 'Số lượt bù phải lớn hơn 0';
  end if;
  insert into public.assessment_extra_attempts(assessment_id, student_id, extra, reason, granted_by)
  values (p_assessment, p_student, p_extra, coalesce(btrim(p_reason),''), auth.uid())
  on conflict (assessment_id, student_id) do update
    set extra = public.assessment_extra_attempts.extra + excluded.extra,
        reason = excluded.reason,
        granted_by = excluded.granted_by;
  select extra into v_total from public.assessment_extra_attempts
  where assessment_id=p_assessment and student_id=p_student;
  return v_total;
end $$;

create function public.create_student_account(p_email text, p_full_name text, p_password text, p_class_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email,'')));
begin
  if auth.uid() is null or public.current_app_role()<>'TEACHER' then
    raise exception 'Only teachers can create student accounts';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email không hợp lệ';
  end if;
  if length(coalesce(p_password,'')) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự';
  end if;
  if length(btrim(coalesce(p_full_name,''))) < 2 then
    raise exception 'Nhập họ tên học sinh';
  end if;
  if exists(select 1 from auth.users u where u.email=v_email and u.is_sso_user=false and u.deleted_at is null) then
    raise exception 'Email đã được sử dụng';
  end if;
  if p_class_id is not null and not public.can_manage_class(p_class_id) then
    raise exception 'Bạn không quản lý lớp này';
  end if;
  v_id := gen_random_uuid();
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                         raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('sub', v_id::text, 'full_name', btrim(p_full_name)),
          now(), now());
  -- Trigger auth_user_profile tự tạo hồ sơ với vai trò STUDENT.
  if p_class_id is not null then
    insert into public.class_members(class_id, student_id) values (p_class_id, v_id) on conflict do nothing;
  end if;
  return v_id;
end $$;

revoke all on function public.grant_extra_attempts(uuid,uuid,integer,text), public.create_student_account(text,text,text,uuid) from public, anon;
grant execute on function public.grant_extra_attempts(uuid,uuid,integer,text), public.create_student_account(text,text,text,uuid) to authenticated;
