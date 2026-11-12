-- Nhóm 3 — AI, trò chơi, Realtime:
--   1) AI tạo câu hỏi nháp: RPC create_ai_request (hạn mức 5 lượt/ngày theo giờ Việt Nam),
--      RPC run_ai_generation (bộ sinh mẫu chạy phía máy chủ, ghi vào ai_generation_outputs),
--      RPC approve_ai_output (duyệt / sửa-và-duyệt → vào ngân hàng câu hỏi kèm mục tiêu).
--      Bảng ai_generation_requests / ai_generation_outputs đã có từ educmind_lms_extended_features_v1.
--   2) Trò chơi ôn tập: bảng game_sessions lưu lịch sử các ván Nhanh / Đua tốc độ / Sinh tồn
--      (chơi bằng câu hỏi trắc nghiệm trong ngân hàng — không ảnh hưởng điểm chính thức).
--   3) Realtime: bảng notifications đã thuộc publication supabase_realtime; phần trình duyệt
--      tự đăng ký kênh và dự phòng tự nạp lại khi không có kết nối realtime.

create table public.game_sessions(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  mode text not null check(mode in ('BLITZ','RACE','SURVIVAL')),
  source text not null default 'BANK',
  question_count integer not null check(question_count>0),
  correct_count integer not null check(correct_count>=0 and correct_count<=question_count),
  score numeric(7,2) not null default 0,
  duration_seconds integer not null check(duration_seconds>=0),
  played_at timestamptz not null default now());
create index game_sessions_course_idx on public.game_sessions(course_id);
create index game_sessions_student_idx on public.game_sessions(student_id);
alter table public.game_sessions enable row level security;
create policy game_session_self_write on public.game_sessions for insert to authenticated
  with check (student_id=auth.uid());
create policy game_session_read on public.game_sessions for select to authenticated
  using (student_id=auth.uid() or exists(select 1 from public.courses c where c.id=course_id and public.can_manage_course(c.id)));
grant select,insert on public.game_sessions to authenticated;

-- Gửi yêu cầu AI sinh câu hỏi (hạn mức 5 lượt/ngày của mỗi giáo viên, tính theo giờ Việt Nam).
create function public.create_ai_request(p_lesson uuid, p_quantity integer, p_parameters jsonb default '{}')
returns public.ai_generation_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v_today integer; v_row public.ai_generation_requests;
begin
  if auth.uid() is null or public.current_app_role()<>'TEACHER' then
    raise exception 'Only teachers can request AI generation';
  end if;
  if not exists(select 1 from public.lessons l where l.id=p_lesson and public.can_manage_course(l.course_id)) then
    raise exception 'Bạn không quản lý bài học này';
  end if;
  if p_quantity is null or p_quantity<1 or p_quantity>20 then
    raise exception 'Số lượng phải từ 1 đến 20';
  end if;
  select count(*) into v_today from public.ai_generation_requests
  where teacher_id=auth.uid()
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh');
  if v_today>=5 then
    raise exception 'Đã hết lượt yêu cầu AI trong ngày (tối đa 5 lượt, tính theo giờ Việt Nam). Thử lại vào ngày hôm sau.';
  end if;
  insert into public.ai_generation_requests(teacher_id, lesson_id, quantity, parameters)
  values (auth.uid(), p_lesson, p_quantity, coalesce(p_parameters,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end $$;

-- Bộ sinh câu hỏi nháp (mẫu có kiểm chứng, chạy phía máy chủ — không cần API AI bên ngoài).
create function public.run_ai_generation(p_request uuid) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r public.ai_generation_requests%rowtype;
  v_lesson_title text; v_objs uuid[]; v_descs text[];
  v_kind text; v_diff text; v_bloom text;
  v_obj uuid; v_desc text; v_content text; v_options jsonb; v_correct jsonb;
  v_pos integer; v_count integer := 0;
begin
  select * into r from public.ai_generation_requests where id=p_request for update;
  if not found then raise exception 'Không tìm thấy yêu cầu'; end if;
  if auth.uid() is null or public.current_app_role()<>'TEACHER' or r.teacher_id<>auth.uid() then
    raise exception 'Only the requesting teacher can run generation';
  end if;
  if r.status<>'PROCESSING' then raise exception 'Yêu cầu này đã được xử lý'; end if;
  select l.title into v_lesson_title from public.lessons l where l.id=r.lesson_id;
  select array_agg(o.id order by o.code), array_agg(o.description order by o.code)
    into v_objs, v_descs
  from public.learning_objectives o
  where o.lesson_id=r.lesson_id
    and (coalesce(r.parameters->'objectives','[]'::jsonb)='[]'::jsonb
         or o.id::text in (select jsonb_array_elements_text(r.parameters->'objectives')));
  if v_objs is null or array_length(v_objs,1)=0 then
    update public.ai_generation_requests
    set status='FAILED', error_message='Bài học chưa có mục tiêu học tập để sinh câu hỏi.', completed_at=now()
    where id=p_request;
    perform public.notify_user(r.teacher_id,'AI_GENERATION_FAILED','AI không tạo được câu hỏi',
      'Bài học chưa có mục tiêu học tập.', jsonb_build_object('page','ai'));
    return 0;
  end if;
  for k in 0..r.quantity-1 loop
    v_pos := 1 + (k % array_length(v_objs,1));
    v_obj := v_objs[v_pos]; v_desc := v_descs[v_pos];
    v_kind := coalesce(nullif(r.parameters->>'kind','AUTO'),
      (array['SINGLE_CHOICE','TRUE_FALSE','MULTIPLE_CHOICE','SHORT_ANSWER'])[1 + (k % 4)]);
    v_diff := coalesce(nullif(r.parameters->>'difficulty','AUTO'),
      (array['EASY','MEDIUM','HARD'])[1 + (k % 3)]);
    v_bloom := coalesce(nullif(r.parameters->>'bloom','AUTO'),
      (array['REMEMBER','UNDERSTAND','APPLY','ANALYZE','EVALUATE','CREATE'])[1 + (k % 6)]);
    v_options := '[]'::jsonb; v_correct := null;
    if v_kind='SINGLE_CHOICE' then
      v_content := '(AI) Câu '||(k+1)||': Phát biểu nào đúng nhất về “'||v_desc||'” trong bài “'||v_lesson_title||'”?';
      v_pos := k % 4;
      v_options := jsonb_build_array(
        case when v_pos=0 then 'Nội dung này là trọng tâm của bài học' else 'Nội dung này chỉ mang tính tham khảo' end,
        case when v_pos=1 then 'Nội dung này là trọng tâm của bài học' else 'Nội dung này không được đề cập trong bài' end,
        case when v_pos=2 then 'Nội dung này là trọng tâm của bài học' else 'Nội dung này thuộc một bài học khác' end,
        case when v_pos=3 then 'Nội dung này là trọng tâm của bài học' else 'Nội dung này chưa được xác minh' end);
      v_correct := to_jsonb(v_pos);
    elsif v_kind='TRUE_FALSE' then
      v_content := '(AI) Câu '||(k+1)||': Nhận định sau đúng hay sai: “'||v_desc||'” là nội dung cốt lõi của bài “'||v_lesson_title||'”.';
      v_options := '["Đúng","Sai"]'::jsonb; v_correct := 'true'::jsonb;
    elsif v_kind='MULTIPLE_CHOICE' then
      v_content := '(AI) Câu '||(k+1)||': Chọn tất cả phát biểu đúng liên quan đến “'||v_desc||'”.';
      v_options := '["Phát biểu đúng về mục tiêu này","Phát biểu sai lệch","Phát biểu đúng khác về mục tiêu này","Phát biểu không liên quan"]'::jsonb;
      v_correct := '[0,2]'::jsonb;
    elsif v_kind='SHORT_ANSWER' then
      v_content := '(AI) Câu '||(k+1)||': Nêu ngắn gọn ý chính của mục tiêu “'||v_desc||'”.';
    else
      v_kind := 'ESSAY';
      v_content := '(AI) Câu '||(k+1)||': Trình bày và lấy ví dụ minh họa cho “'||v_desc||'”.';
    end if;
    insert into public.ai_generation_outputs(request_id, content, kind, objective_id, difficulty, bloom_level, options, correct_answer)
    values (p_request, v_content, v_kind, v_obj, v_diff, v_bloom, v_options, v_correct);
    v_count := v_count + 1;
  end loop;
  update public.ai_generation_requests set status='COMPLETED', completed_at=now(), error_message=null where id=p_request;
  perform public.notify_user(r.teacher_id,'AI_GENERATION_COMPLETED','AI đã tạo xong '||v_count||' câu hỏi nháp',
    'Bài “'||v_lesson_title||'”. Hãy duyệt các bản nháp trước khi đưa vào ngân hàng.', jsonb_build_object('page','ai'));
  return v_count;
end $$;

-- Duyệt (có thể sửa nội dung/đáp án) một bản nháp: tạo câu hỏi thật + gắn mục tiêu + ghi nhận duyệt.
create function public.approve_ai_output(p_output uuid, p_content text, p_options jsonb, p_correct_answer jsonb,
                                        p_difficulty text, p_bloom_level text, p_grade smallint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_out record; v_q uuid; v_kind text; v_len integer; v_edited boolean;
begin
  select o.*, r.teacher_id, l.course_id into v_out
  from public.ai_generation_outputs o
  join public.ai_generation_requests r on r.id=o.request_id
  join public.lessons l on l.id=r.lesson_id
  where o.id=p_output for update;
  if not found then raise exception 'Không tìm thấy bản nháp'; end if;
  if auth.uid() is null or public.current_app_role()<>'TEACHER' or v_out.teacher_id<>auth.uid()
     or not public.can_manage_course(v_out.course_id) then
    raise exception 'Only the requesting teacher can review drafts';
  end if;
  if v_out.approved_question_id is not null then raise exception 'Bản nháp này đã được duyệt'; end if;
  if coalesce(btrim(coalesce(p_content,'')),'')='' then raise exception 'Nội dung câu hỏi không được để trống'; end if;
  v_kind := v_out.kind;
  if v_kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE') then
    v_len := coalesce(jsonb_array_length(coalesce(p_options,'[]'::jsonb)),0);
    if v_len<2 then raise exception 'Câu trắc nghiệm cần ít nhất 2 lựa chọn'; end if;
    if v_kind='TRUE_FALSE' then
      if p_correct_answer is null or jsonb_typeof(p_correct_answer)<>'boolean' then
        raise exception 'Đáp án Đúng/Sai không hợp lệ';
      end if;
    elsif v_kind='SINGLE_CHOICE' then
      if p_correct_answer is null or jsonb_typeof(p_correct_answer)<>'number'
         or ((p_correct_answer #>> '{}')::int)<0 or ((p_correct_answer #>> '{}')::int)>=v_len then
        raise exception 'Đáp án phải là một lựa chọn hợp lệ';
      end if;
    else
      if p_correct_answer is null or jsonb_typeof(p_correct_answer)<>'array'
         or jsonb_array_length(p_correct_answer)<1 then
        raise exception 'Đáp án phải là danh sách các lựa chọn đúng';
      end if;
    end if;
  end if;
  v_edited := coalesce(p_content,'') is distinct from v_out.content
    or coalesce(p_options,'[]'::jsonb) is distinct from coalesce(v_out.options,'[]'::jsonb)
    or coalesce(p_correct_answer,'null'::jsonb) is distinct from coalesce(v_out.correct_answer,'null'::jsonb);
  insert into public.questions(course_id, content, kind, options, correct_answer, difficulty, grade, bloom_level, created_by)
  values (v_out.course_id, btrim(p_content), v_kind,
          coalesce(p_options,'[]'::jsonb), p_correct_answer,
          coalesce(nullif(p_difficulty,''),'MEDIUM'), p_grade,
          nullif(coalesce(p_bloom_level,''),''), auth.uid())
  returning id into v_q;
  insert into public.question_objectives(question_id, objective_id) values (v_q, v_out.objective_id);
  update public.ai_generation_outputs
  set review_status = case when v_edited then 'EDITED_AND_APPROVED' else 'APPROVED' end,
      review_note = '', reviewed_by = auth.uid(), reviewed_at = now(), approved_question_id = v_q
  where id = p_output;
  return v_q;
end $$;

revoke all on function public.create_ai_request(uuid,integer,jsonb), public.run_ai_generation(uuid),
  public.approve_ai_output(uuid,text,jsonb,jsonb,text,text,smallint) from public, anon;
grant execute on function public.create_ai_request(uuid,integer,jsonb), public.run_ai_generation(uuid),
  public.approve_ai_output(uuid,text,jsonb,jsonb,text,text,smallint) to authenticated;
