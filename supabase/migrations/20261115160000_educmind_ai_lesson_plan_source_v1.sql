create or replace function public.create_ai_request(p_lesson uuid, p_quantity integer, p_parameters jsonb default '{}')
returns public.ai_generation_requests
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row public.ai_generation_requests;
  v_assignment uuid;
  v_source text;
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
  if p_parameters is not null and jsonb_typeof(p_parameters)<>'object' then
    raise exception 'Tham số yêu cầu AI không hợp lệ';
  end if;

  if p_parameters ? 'source_document_text'
     and jsonb_typeof(p_parameters->'source_document_text') not in ('string','null') then
    raise exception 'Nội dung giáo án trong yêu cầu không hợp lệ';
  end if;
  v_source := p_parameters->>'source_document_text';
  if v_source is not null and length(v_source)>10000 then
    raise exception 'Giáo án vượt giới hạn 10.000 ký tự';
  end if;
  if p_parameters ? 'assignment_id' then
    if coalesce(p_parameters->>'assignment_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Mã bài tập trong yêu cầu AI không hợp lệ';
    end if;
    v_assignment := (p_parameters->>'assignment_id')::uuid;
    if not exists(
      select 1
      from public.assignments a
      where a.id=v_assignment and a.lesson_id=p_lesson and a.status='DRAFT'
        and a.deleted_at is null and public.can_manage_assignment(a.id)
        and not exists(select 1 from public.assignment_submissions s where s.assignment_id=a.id)
    ) then
      raise exception 'Chỉ có thể tạo câu AI cho bài tập nháp chưa có bài nộp thuộc bài học đã chọn';
    end if;
  end if;

  insert into public.ai_generation_requests(teacher_id,lesson_id,quantity,parameters)
  values(auth.uid(),p_lesson,p_quantity,coalesce(p_parameters,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_ai_request(uuid,integer,jsonb) from public,anon;
grant execute on function public.create_ai_request(uuid,integer,jsonb) to authenticated;

create function public.approve_ai_output_for_assignment(
  p_output uuid,
  p_content text,
  p_options jsonb,
  p_correct_answer jsonb,
  p_difficulty text,
  p_bloom_level text,
  p_grade smallint,
  p_assignment uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_out record;
  v_question uuid;
  v_order integer;
begin
  select r.teacher_id,r.lesson_id,l.course_id
  into v_out
  from public.ai_generation_outputs o
  join public.ai_generation_requests r on r.id=o.request_id
  join public.lessons l on l.id=r.lesson_id
  where o.id=p_output;
  if not found then raise exception 'Không tìm thấy bản nháp'; end if;
  if auth.uid() is null or public.current_app_role()<>'TEACHER' or v_out.teacher_id<>auth.uid()
     or not public.can_manage_course(v_out.course_id) then
    raise exception 'Only the requesting teacher can review drafts';
  end if;
  if not exists(
    select 1 from public.assignments a
    where a.id=p_assignment and a.lesson_id=v_out.lesson_id and a.course_id=v_out.course_id
      and a.status='DRAFT' and a.deleted_at is null and public.can_manage_assignment(a.id)
      and not exists(select 1 from public.assignment_submissions s where s.assignment_id=a.id)
  ) then
    raise exception 'Chỉ có thể thêm câu đã duyệt vào bài tập nháp chưa có bài nộp thuộc bài học này';
  end if;

  v_question := public.approve_ai_output(
    p_output,p_content,p_options,p_correct_answer,p_difficulty,p_bloom_level,p_grade
  );
  select coalesce(max(display_order),0)+1 into v_order
  from public.assignment_questions where assignment_id=p_assignment;
  insert into public.assignment_questions(assignment_id,question_id,display_order)
  values(p_assignment,v_question,v_order);
  return v_question;
end;
$$;

revoke all on function public.approve_ai_output_for_assignment(uuid,text,jsonb,jsonb,text,text,smallint,uuid) from public,anon;
grant execute on function public.approve_ai_output_for_assignment(uuid,text,jsonb,jsonb,text,text,smallint,uuid) to authenticated;
