alter table public.questions drop constraint if exists questions_kind_check;
alter table public.questions add constraint questions_kind_check
  check(kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING','SHORT_ANSWER','ESSAY'));

alter table public.ai_generation_outputs drop constraint if exists ai_generation_outputs_kind_check;
alter table public.ai_generation_outputs add constraint ai_generation_outputs_kind_check
  check(kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING','SHORT_ANSWER','ESSAY'));

create or replace function public.complete_ai_generation_job(p_job uuid,p_items jsonb,p_error text default null)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  j public.ai_generation_jobs%rowtype;
  r public.ai_generation_requests%rowtype;
  v_selected jsonb;
  v_allowed_ids uuid[];
  v_allowed_count integer;
  v_item jsonb;
  v_item_id text;
  v_objective uuid;
  v_kind text;
  v_requested_kind text;
  v_content text;
  v_difficulty text;
  v_bloom text;
  v_options jsonb;
  v_indices jsonb;
  v_fill_answers jsonb;
  v_index_json jsonb;
  v_indices_int integer[];
  v_index integer;
  v_number numeric;
  v_model_answer text;
  v_correct_answer jsonb;
  v_option_count integer;
  v_unique_option_count integer;
  v_left_count integer;
  v_right_count integer;
  v_marker_count integer;
  v_saved integer:=0;
  v_remaining integer;
  v_failed integer;
  v_error text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;

  select * into j from public.ai_generation_jobs where id=p_job;
  if not found then raise exception 'Không tìm thấy tác vụ AI'; end if;
  select * into r from public.ai_generation_requests where id=j.request_id for update;
  if not found then raise exception 'Không tìm thấy yêu cầu AI'; end if;
  select * into j from public.ai_generation_jobs where id=p_job for update;
  if j.status='COMPLETED' then return j.question_count; end if;
  if j.status='FAILED' then return 0; end if;
  if j.status<>'PROCESSING' then raise exception 'Tác vụ AI không ở trạng thái xử lý'; end if;

  if nullif(btrim(coalesce(p_error,'')),'') is not null then
    update public.ai_generation_jobs
    set status='FAILED',error_message=left(btrim(p_error),1000),completed_at=now(),updated_at=now()
    where id=p_job;
  else
    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<>j.question_count then
      raise exception 'AI phải trả về đúng % câu hỏi cho lô này',j.question_count;
    end if;

    v_selected:=coalesce(r.parameters->'objectives','[]'::jsonb);
    if jsonb_typeof(v_selected) is distinct from 'array' then raise exception 'Danh sách mục tiêu trong yêu cầu không hợp lệ'; end if;
    if jsonb_array_length(v_selected)=0 then
      select array_agg(o.id order by o.code),count(*)::integer
      into v_allowed_ids,v_allowed_count
      from public.learning_objectives o where o.lesson_id=r.lesson_id;
    else
      select array_agg(o.id order by objective_lesson.title,o.code),count(*)::integer
      into v_allowed_ids,v_allowed_count
      from public.learning_objectives o
      join public.lessons objective_lesson on objective_lesson.id=o.lesson_id
      join public.lessons request_lesson on request_lesson.id=r.lesson_id
      where objective_lesson.course_id=request_lesson.course_id
        and o.id::text in (select value #>> '{}' from jsonb_array_elements(v_selected) as x(value));
      if v_allowed_count<>jsonb_array_length(v_selected) then raise exception 'Một hoặc nhiều mục tiêu không thuộc khóa học được chọn'; end if;
    end if;
    if coalesce(v_allowed_count,0)=0 then raise exception 'Bài học chưa có mục tiêu để sinh câu hỏi'; end if;

    for v_item in select value from jsonb_array_elements(p_items) as x(value) loop
      if jsonb_typeof(v_item)<>'object' then raise exception 'Định dạng câu hỏi AI không hợp lệ'; end if;
      v_item_id:=v_item->>'objective_id';
      if v_item_id is null or v_item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Câu hỏi AI có mã mục tiêu không hợp lệ';
      end if;
      v_objective:=v_item_id::uuid;
      if not(v_objective=any(v_allowed_ids)) then raise exception 'Câu hỏi AI gắn với mục tiêu ngoài yêu cầu'; end if;

      v_kind:=v_item->>'kind';
      if v_kind is null or v_kind not in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING','SHORT_ANSWER','ESSAY') then
        raise exception 'Dạng câu hỏi AI không hợp lệ';
      end if;
      v_requested_kind:=case lower(btrim(coalesce(r.parameters->>'kind','AUTO')))
        when 'dien khuyet' then 'FILL_IN_BLANK'
        when 'điền khuyết' then 'FILL_IN_BLANK'
        when 'fill in blank' then 'FILL_IN_BLANK'
        when 'fill_in_blank' then 'FILL_IN_BLANK'
        when 'ghep doi' then 'MATCHING'
        when 'ghép đôi' then 'MATCHING'
        when 'matching' then 'MATCHING'
        else upper(replace(btrim(coalesce(r.parameters->>'kind','AUTO')),' ','_'))
      end;
      if v_requested_kind not in ('AUTO','SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING','SHORT_ANSWER','ESSAY')
         or (v_requested_kind<>'AUTO' and v_requested_kind<>v_kind) then
        raise exception 'Dạng câu hỏi AI không khớp yêu cầu';
      end if;
      v_difficulty:=v_item->>'difficulty';
      if v_difficulty is null or v_difficulty not in ('EASY','MEDIUM','HARD') then raise exception 'Độ khó AI không hợp lệ'; end if;
      if coalesce(r.parameters->>'difficulty','AUTO') not in ('AUTO','EASY','MEDIUM','HARD')
         or (coalesce(r.parameters->>'difficulty','AUTO')<>'AUTO' and r.parameters->>'difficulty'<>v_difficulty) then
        raise exception 'Độ khó AI không khớp yêu cầu';
      end if;
      v_bloom:=v_item->>'bloom_level';
      if v_bloom is null or v_bloom not in ('REMEMBER','UNDERSTAND','APPLY','ANALYZE','EVALUATE','CREATE') then
        raise exception 'Cấp độ Bloom AI không hợp lệ';
      end if;
      if coalesce(r.parameters->>'bloom','AUTO') not in ('AUTO','REMEMBER','UNDERSTAND','APPLY','ANALYZE','EVALUATE','CREATE')
         or (coalesce(r.parameters->>'bloom','AUTO')<>'AUTO' and r.parameters->>'bloom'<>v_bloom) then
        raise exception 'Cấp độ Bloom AI không khớp yêu cầu';
      end if;

      v_content:=btrim(coalesce(v_item->>'content',''));
      if v_content='' or length(v_content)>5000 then raise exception 'Nội dung câu hỏi AI không hợp lệ'; end if;
      v_model_answer:=btrim(coalesce(v_item->>'model_answer',''));
      if jsonb_typeof(v_item->'model_answer') is distinct from 'string' or length(v_model_answer)>5000 then
        raise exception 'Đáp án tham khảo AI không hợp lệ';
      end if;

      v_options:=v_item->'options';
      v_indices:=v_item->'correct_indices';
      v_fill_answers:=v_item->'fill_answers';
      if jsonb_typeof(v_indices) is distinct from 'array' or jsonb_typeof(v_fill_answers) is distinct from 'array' then
        raise exception 'Đáp án AI không đúng định dạng';
      end if;

      v_indices_int:=array[]::integer[];
      for v_index_json in select value from jsonb_array_elements(v_indices) as x(value) loop
        if jsonb_typeof(v_index_json)<>'number' then raise exception 'Chỉ số đáp án AI phải là số nguyên'; end if;
        v_number:=(v_index_json #>> '{}')::numeric;
        if trunc(v_number)<>v_number or v_number<0 or v_number>19 then raise exception 'Chỉ số đáp án AI nằm ngoài phạm vi'; end if;
        v_index:=v_number::integer;
        if v_index=any(v_indices_int) then raise exception 'Chỉ số đáp án AI bị lặp'; end if;
        v_indices_int:=array_append(v_indices_int,v_index);
      end loop;

      v_correct_answer:=null;
      if v_kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE') then
        if jsonb_typeof(v_options) is distinct from 'array' then raise exception 'Lựa chọn AI không hợp lệ'; end if;
        select count(*)::integer into v_option_count
        from jsonb_array_elements(v_options) as x(value)
        where jsonb_typeof(x.value)='string' and btrim(x.value #>> '{}')<>'';
        select count(distinct lower(btrim(x.value #>> '{}'))) into v_unique_option_count
        from jsonb_array_elements(v_options) as x(value);
        if v_option_count<>4 or v_unique_option_count<>4 or jsonb_array_length(v_options)<>4 then
          raise exception 'Câu trắc nghiệm AI phải có đúng 4 lựa chọn không trùng';
        end if;
        if cardinality(v_indices_int)=0 or exists(select 1 from unnest(v_indices_int) as x(value) where x.value>3) then
          raise exception 'Đáp án AI vượt quá số lựa chọn';
        end if;
        if v_kind='SINGLE_CHOICE' and cardinality(v_indices_int)<>1 then raise exception 'Câu một lựa chọn AI phải có đúng một đáp án'; end if;
        if v_kind='MULTIPLE_CHOICE' and cardinality(v_indices_int)<2 then raise exception 'Câu nhiều lựa chọn AI cần ít nhất hai đáp án'; end if;
        if jsonb_array_length(v_fill_answers)<>0 then raise exception 'Đáp án điền khuyết AI không hợp lệ'; end if;
        v_correct_answer:=to_jsonb(v_indices_int);
        if v_kind='SINGLE_CHOICE' then v_correct_answer:=to_jsonb(v_indices_int[1]); end if;
      elsif v_kind='TRUE_FALSE' then
        if jsonb_typeof(v_options) is distinct from 'array' or jsonb_array_length(v_options)<>0
           or jsonb_array_length(v_fill_answers)<>0 or cardinality(v_indices_int)<>1 or v_indices_int[1] not in (0,1) then
          raise exception 'Câu Đúng/Sai AI phải có một đáp án hợp lệ';
        end if;
        v_options:='["Đúng","Sai"]'::jsonb;
        v_correct_answer:=to_jsonb(v_indices_int[1]=0);
      elsif v_kind='FILL_IN_BLANK' then
        if jsonb_typeof(v_options) is distinct from 'array' or jsonb_array_length(v_options)<>0
           or cardinality(v_indices_int)<>0 then
          raise exception 'Câu điền khuyết AI không đúng định dạng';
        end if;
        select count(*)::integer into v_marker_count from regexp_matches(v_content,'_{3,}','g');
        if v_marker_count=0 or jsonb_array_length(v_fill_answers)<>v_marker_count then
          raise exception 'Câu điền khuyết AI cần một đáp án cho mỗi chỗ trống';
        end if;
        if exists(select 1 from jsonb_array_elements(v_fill_answers) as x(value)
                  where jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')='') then
          raise exception 'Đáp án điền khuyết AI không được để trống';
        end if;
        v_correct_answer:=v_fill_answers;
      elsif v_kind='MATCHING' then
        if jsonb_typeof(v_options) is distinct from 'object'
           or jsonb_typeof(v_options->'left') is distinct from 'array'
           or jsonb_typeof(v_options->'right') is distinct from 'array'
           or jsonb_array_length(v_fill_answers)<>0 then
          raise exception 'Câu ghép đôi AI không đúng định dạng';
        end if;
        v_left_count:=jsonb_array_length(v_options->'left');
        v_right_count:=jsonb_array_length(v_options->'right');
        if v_left_count<2 or v_left_count>20 or v_right_count<>v_left_count or cardinality(v_indices_int)<>v_left_count then
          raise exception 'Câu ghép đôi AI cần từ 2 đến 20 cặp hợp lệ';
        end if;
        if exists(select 1 from jsonb_array_elements(v_options->'left') as x(value)
                  where jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')='')
           or exists(select 1 from jsonb_array_elements(v_options->'right') as x(value)
                  where jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')='') then
          raise exception 'Mục ghép đôi AI không được để trống';
        end if;
        if exists(select 1 from jsonb_array_elements_text(v_options->'left') as x(value) group by lower(btrim(x.value)) having count(*)>1)
           or exists(select 1 from jsonb_array_elements_text(v_options->'right') as x(value) group by lower(btrim(x.value)) having count(*)>1)
           or exists(select 1 from unnest(v_indices_int) as x(value) where x.value>=v_right_count) then
          raise exception 'Cặp ghép AI bị lặp hoặc nằm ngoài phạm vi';
        end if;
        v_correct_answer:=to_jsonb(v_indices_int);
      else
        if jsonb_typeof(v_options) is distinct from 'array' or jsonb_array_length(v_options)<>0
           or jsonb_array_length(v_fill_answers)<>0 or cardinality(v_indices_int)<>0 or v_model_answer='' then
          raise exception 'Câu trả lời mở AI cần đáp án tham khảo và không có lựa chọn';
        end if;
        v_correct_answer:=to_jsonb(v_model_answer);
      end if;

      insert into public.ai_generation_outputs(request_id,job_id,content,kind,objective_id,difficulty,bloom_level,options,correct_answer)
      values(j.request_id,p_job,v_content,v_kind,v_objective,v_difficulty,v_bloom,v_options,v_correct_answer);
      v_saved:=v_saved+1;
    end loop;

    update public.ai_generation_jobs
    set status='COMPLETED',error_message=null,completed_at=now(),updated_at=now()
    where id=p_job;
  end if;

  select count(*) filter(where status in ('QUEUED','PROCESSING')),
         count(*) filter(where status='FAILED'),
         string_agg(error_message,'; ' order by ordinal) filter(where status='FAILED')
  into v_remaining,v_failed,v_error
  from public.ai_generation_jobs where request_id=j.request_id;
  if v_remaining=0 then
    update public.ai_generation_requests
    set status=case when v_failed=0 then 'COMPLETED' else 'FAILED' end,
        error_message=case when v_failed=0 then null else left(coalesce(v_error,'Một hoặc nhiều lô câu hỏi bị lỗi.'),1000) end,
        completed_at=now()
    where id=j.request_id and status='PROCESSING';
    if found then
      if v_failed=0 then
        perform public.notify_user(r.teacher_id,'AI_GENERATION_COMPLETED','AI đã tạo xong câu hỏi nháp',
          'Các mục tiêu đã chọn đã có bản nháp. Hãy duyệt trước khi đưa vào ngân hàng câu hỏi.',
          jsonb_build_object('page','ai','request_id',j.request_id));
      else
        perform public.notify_user(r.teacher_id,'AI_GENERATION_FAILED','Một số câu hỏi AI chưa tạo được',
          left(coalesce(v_error,'Một hoặc nhiều lô câu hỏi bị lỗi.'),1000),
          jsonb_build_object('page','ai','request_id',j.request_id));
      end if;
    end if;
  end if;
  return v_saved;
end;
$$;

revoke all on function public.complete_ai_generation_job(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.complete_ai_generation_job(uuid,jsonb,text) to service_role;

create or replace function public.autograde_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  q record;
  v_blank boolean;
  v_score numeric;
  v_answer_text text[];
  v_correct_text text[];
  v_answer_items integer;
  v_correct_items integer;
  v_matching_count integer;
  v_matching_correct integer;
begin
  select t.* into att from public.assessment_attempts t where t.id=p_attempt;
  if not found or att.status='IN_PROGRESS' then return; end if;
  for q in
    select aq.question_id,aq.weight,qu.kind,qu.options,qu.correct_answer,sa.answer_content
    from public.assessment_questions aq
    join public.questions qu on qu.id=aq.question_id
    left join public.submission_answers sa on sa.attempt_id=p_attempt and sa.question_id=aq.question_id
    where aq.assessment_id=att.assessment_id
    order by aq.display_order
  loop
    v_blank := case
      when q.answer_content is null then true
      when jsonb_typeof(q.answer_content)='null' then true
      when jsonb_typeof(q.answer_content)='string' then btrim(q.answer_content #>> '{}')=''
      when jsonb_typeof(q.answer_content)='array' then not exists(
        select 1 from jsonb_array_elements(q.answer_content) as x(value)
        where jsonb_typeof(x.value)<>'null'
          and (jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')<>'')
      )
      else false end;
    if v_blank then
      v_score := 0;
    elsif q.kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE')
          and q.correct_answer is not null and jsonb_typeof(q.correct_answer)<>'null' then
      if public.answer_tokens(q.answer_content)=public.answer_tokens(q.correct_answer) then
        v_score := q.weight;
      else
        v_score := 0;
      end if;
    elsif q.kind='FILL_IN_BLANK' then
      if jsonb_typeof(q.answer_content)<>'array' or jsonb_typeof(q.correct_answer)<>'array'
         or jsonb_array_length(q.answer_content)<>jsonb_array_length(q.correct_answer) then
        v_score:=0;
      else
        select array_agg(lower(btrim(x.value #>> '{}')) order by x.ordinality),
               count(*) filter(where jsonb_typeof(x.value)='string')::integer
        into v_answer_text,v_answer_items
        from jsonb_array_elements(q.answer_content) with ordinality as x(value,ordinality);
        select array_agg(lower(btrim(x.value #>> '{}')) order by x.ordinality),
               count(*) filter(where jsonb_typeof(x.value)='string')::integer
        into v_correct_text,v_correct_items
        from jsonb_array_elements(q.correct_answer) with ordinality as x(value,ordinality);
        if v_answer_items=jsonb_array_length(q.answer_content)
           and v_correct_items=jsonb_array_length(q.correct_answer)
           and v_answer_text=v_correct_text then v_score:=q.weight;
        else v_score:=0; end if;
      end if;
    elsif q.kind='MATCHING' then
      if jsonb_typeof(q.answer_content)<>'array' or jsonb_typeof(q.correct_answer)<>'array'
         or jsonb_array_length(q.correct_answer)=0
         or jsonb_array_length(q.answer_content)<>jsonb_array_length(q.correct_answer) then
        v_score:=0;
      else
        select count(*)::integer,
               count(*) filter(where jsonb_typeof(answer.value)='number' and answer.value=correct.value)::integer
        into v_matching_count,v_matching_correct
        from jsonb_array_elements(q.correct_answer) with ordinality as correct(value,ordinality)
        left join jsonb_array_elements(q.answer_content) with ordinality as answer(value,ordinality)
          on answer.ordinality=correct.ordinality;
        v_score:=q.weight*v_matching_correct/v_matching_count;
      end if;
    else
      continue;  -- câu tự luận / trả lời ngắn có nội dung, hoặc câu chưa có đáp án: chờ giáo viên chấm
    end if;
    perform public.educmind_write_answer_score(p_attempt,q.question_id,v_score);
  end loop;
  perform public.refresh_attempt_grade(p_attempt);
end $$;

create or replace function public.approve_ai_output(p_output uuid,p_content text,p_options jsonb,p_correct_answer jsonb,
  p_difficulty text,p_bloom_level text,p_grade smallint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_out record;
  v_q uuid;
  v_kind text;
  v_len integer;
  v_left integer;
  v_right integer;
  v_markers integer;
  v_edited boolean;
begin
  select o.*,r.teacher_id,l.course_id into v_out
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
  if coalesce(btrim(coalesce(p_content,'')),'')='' or length(p_content)>5000 then raise exception 'Nội dung câu hỏi không hợp lệ'; end if;
  v_kind:=v_out.kind;
  if v_kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE') then
    if jsonb_typeof(p_options) is distinct from 'array' then raise exception 'Lựa chọn không hợp lệ'; end if;
    v_len:=jsonb_array_length(p_options);
    if v_len<2 then raise exception 'Câu trắc nghiệm cần ít nhất 2 lựa chọn'; end if;
    if v_kind='TRUE_FALSE' then
      if p_correct_answer is null or jsonb_typeof(p_correct_answer)<>'boolean' then raise exception 'Đáp án Đúng/Sai không hợp lệ'; end if;
    elsif v_kind='SINGLE_CHOICE' then
      if p_correct_answer is null or jsonb_typeof(p_correct_answer)<>'number'
         or ((p_correct_answer #>> '{}')::numeric)<>trunc((p_correct_answer #>> '{}')::numeric)
         or ((p_correct_answer #>> '{}')::numeric)<0 or ((p_correct_answer #>> '{}')::numeric)>=v_len then
        raise exception 'Đáp án phải là một lựa chọn hợp lệ';
      end if;
    else
      if p_correct_answer is null or jsonb_typeof(p_correct_answer)<>'array'
         or jsonb_array_length(p_correct_answer)<1
         or exists(select 1 from jsonb_array_elements(p_correct_answer) as x(value)
           where jsonb_typeof(x.value)<>'number' or (x.value #>> '{}')::numeric<>trunc((x.value #>> '{}')::numeric)
             or (x.value #>> '{}')::numeric<0 or (x.value #>> '{}')::numeric>=v_len)
         or (select count(distinct value) from jsonb_array_elements(p_correct_answer) as x(value))<>jsonb_array_length(p_correct_answer) then
        raise exception 'Đáp án phải là danh sách các lựa chọn đúng';
      end if;
    end if;
  elsif v_kind='FILL_IN_BLANK' then
    if jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options)<>0
       or jsonb_typeof(p_correct_answer) is distinct from 'array' then
      raise exception 'Đáp án điền khuyết không hợp lệ';
    end if;
    select count(*)::integer into v_markers from regexp_matches(p_content,'_{3,}','g');
    if v_markers=0 or jsonb_array_length(p_correct_answer)<>v_markers
       or exists(select 1 from jsonb_array_elements(p_correct_answer) as x(value)
         where jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')='') then
      raise exception 'Điền khuyết cần một đáp án hợp lệ cho mỗi chỗ trống';
    end if;
  elsif v_kind='MATCHING' then
    if jsonb_typeof(p_options) is distinct from 'object'
       or jsonb_typeof(p_options->'left') is distinct from 'array'
       or jsonb_typeof(p_options->'right') is distinct from 'array'
       or jsonb_typeof(p_correct_answer) is distinct from 'array' then
      raise exception 'Dữ liệu ghép đôi không hợp lệ';
    end if;
    v_left:=jsonb_array_length(p_options->'left');
    v_right:=jsonb_array_length(p_options->'right');
    if v_left<2 or v_left>20 or v_right<>v_left or jsonb_array_length(p_correct_answer)<>v_left
       or exists(select 1 from jsonb_array_elements(p_options->'left') as x(value)
         where jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')='')
       or exists(select 1 from jsonb_array_elements(p_options->'right') as x(value)
         where jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')='')
       or exists(select 1 from jsonb_array_elements_text(p_options->'left') as x(value) group by lower(btrim(x.value)) having count(*)>1)
       or exists(select 1 from jsonb_array_elements_text(p_options->'right') as x(value) group by lower(btrim(x.value)) having count(*)>1)
       or exists(select 1 from jsonb_array_elements(p_correct_answer) as x(value)
         where jsonb_typeof(x.value)<>'number' or (x.value #>> '{}')::numeric<>trunc((x.value #>> '{}')::numeric)
           or (x.value #>> '{}')::numeric<0 or (x.value #>> '{}')::numeric>=v_right)
       or (select count(distinct value) from jsonb_array_elements(p_correct_answer) as x(value))<>v_left then
      raise exception 'Cặp ghép cần từ 2 đến 20 mục hợp lệ và ánh xạ đáp án không lặp';
    end if;
  end if;

  v_edited:=coalesce(p_content,'') is distinct from v_out.content
    or coalesce(p_options,'[]'::jsonb) is distinct from coalesce(v_out.options,'[]'::jsonb)
    or coalesce(p_correct_answer,'null'::jsonb) is distinct from coalesce(v_out.correct_answer,'null'::jsonb);
  insert into public.questions(course_id,content,kind,options,correct_answer,difficulty,grade,bloom_level,created_by)
  values(v_out.course_id,btrim(p_content),v_kind,coalesce(p_options,'[]'::jsonb),p_correct_answer,
    coalesce(nullif(p_difficulty,''),'MEDIUM'),p_grade,nullif(coalesce(p_bloom_level,''),''),auth.uid())
  returning id into v_q;
  insert into public.question_objectives(question_id,objective_id) values(v_q,v_out.objective_id);
  update public.ai_generation_outputs
  set review_status=case when v_edited then 'EDITED_AND_APPROVED' else 'APPROVED' end,
      review_note='',reviewed_by=auth.uid(),reviewed_at=now(),approved_question_id=v_q
  where id=p_output;
  return v_q;
end $$;
