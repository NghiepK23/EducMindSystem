-- Replace the template generator with a user-scoped Gemini Edge Function.
drop function if exists public.run_ai_generation(uuid);

create function public.save_ai_output(p_request uuid, p_items jsonb, p_error text default null)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.ai_generation_requests%rowtype;
  v_selected jsonb;
  v_allowed_ids uuid[];
  v_allowed_count integer;
  v_item jsonb;
  v_item_id text;
  v_objective uuid;
  v_kind text;
  v_content text;
  v_difficulty text;
  v_bloom text;
  v_options jsonb;
  v_indices jsonb;
  v_index_json jsonb;
  v_indices_int integer[];
  v_index integer;
  v_number numeric;
  v_model_answer text;
  v_correct_answer jsonb;
  v_option_count integer;
  v_unique_option_count integer;
  v_count integer := 0;
begin
  select * into r
  from public.ai_generation_requests
  where id=p_request
  for update;
  if not found then raise exception 'Không tìm thấy yêu cầu AI'; end if;
  if auth.uid() is null or public.current_app_role() is distinct from 'TEACHER'::public.app_role
     or r.teacher_id<>auth.uid()
     or not exists(select 1 from public.lessons l where l.id=r.lesson_id and public.can_manage_course(l.course_id)) then
    raise exception 'Only the requesting teacher can save generated questions';
  end if;
  if r.status='COMPLETED' then
    select count(*)::integer into v_count from public.ai_generation_outputs where request_id=p_request;
    return v_count;
  end if;
  if r.status='FAILED' then return 0; end if;
  if r.status<>'PROCESSING' then raise exception 'Yêu cầu này không còn ở trạng thái xử lý'; end if;

  if nullif(btrim(coalesce(p_error,'')),'') is not null then
    update public.ai_generation_requests
    set status='FAILED', error_message=left(btrim(p_error),1000), completed_at=now()
    where id=p_request;
    perform public.notify_user(r.teacher_id,'AI_GENERATION_FAILED','AI không tạo được câu hỏi',
      left(btrim(p_error),1000),jsonb_build_object('page','ai','request_id',p_request));
    return 0;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'AI phải trả về danh sách câu hỏi';
  end if;
  if jsonb_array_length(p_items)<>r.quantity then
    raise exception 'AI phải trả về đúng % câu hỏi',r.quantity;
  end if;

  v_selected:=coalesce(r.parameters->'objectives','[]'::jsonb);
  if jsonb_typeof(v_selected) is distinct from 'array' then
    raise exception 'Danh sách mục tiêu trong yêu cầu không hợp lệ';
  end if;
  for v_index_json in select value from jsonb_array_elements(v_selected) as x(value) loop
    if jsonb_typeof(v_index_json)<>'string'
       or (v_index_json #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Mã mục tiêu trong yêu cầu không hợp lệ';
    end if;
  end loop;

  if jsonb_array_length(v_selected)=0 then
    select array_agg(o.id order by o.code),count(*)::integer
    into v_allowed_ids,v_allowed_count
    from public.learning_objectives o
    where o.lesson_id=r.lesson_id;
  else
    select array_agg(o.id order by o.code),count(*)::integer
    into v_allowed_ids,v_allowed_count
    from public.learning_objectives o
    where o.lesson_id=r.lesson_id
      and o.id::text in (select value #>> '{}' from jsonb_array_elements(v_selected) as x(value));
    if v_allowed_count<>jsonb_array_length(v_selected) then
      raise exception 'Một hoặc nhiều mục tiêu không thuộc bài học được chọn';
    end if;
  end if;
  if coalesce(v_allowed_count,0)=0 then raise exception 'Bài học chưa có mục tiêu để sinh câu hỏi'; end if;

  for v_item in select value from jsonb_array_elements(p_items) as x(value) loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'Định dạng câu hỏi AI không hợp lệ'; end if;

    v_item_id:=v_item->>'objective_id';
    if v_item_id is null
       or v_item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Câu hỏi AI có mã mục tiêu không hợp lệ';
    end if;
    v_objective:=v_item_id::uuid;
    if not (v_objective=any(v_allowed_ids)) then raise exception 'Câu hỏi AI gắn với mục tiêu ngoài yêu cầu'; end if;

    v_kind:=v_item->>'kind';
    if v_kind is null or v_kind not in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','SHORT_ANSWER','ESSAY') then
      raise exception 'Dạng câu hỏi AI không hợp lệ';
    end if;
    if coalesce(r.parameters->>'kind','AUTO') not in ('AUTO','SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','SHORT_ANSWER','ESSAY')
       or (coalesce(r.parameters->>'kind','AUTO')<>'AUTO' and r.parameters->>'kind'<>v_kind) then
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
    if jsonb_typeof(v_options) is distinct from 'array'
       or jsonb_typeof(v_indices) is distinct from 'array' then
      raise exception 'Lựa chọn hoặc chỉ số đáp án AI không hợp lệ';
    end if;
    select count(*)::integer into v_option_count
    from jsonb_array_elements(v_options) as x(value)
    where jsonb_typeof(x.value)='string' and btrim(x.value #>> '{}')<>'';
    if v_option_count<>jsonb_array_length(v_options) then raise exception 'Lựa chọn AI phải là các chuỗi không rỗng'; end if;
    select count(distinct lower(btrim(x.value #>> '{}'))) into v_unique_option_count
    from jsonb_array_elements(v_options) as x(value);

    v_indices_int:=array[]::integer[];
    for v_index_json in select value from jsonb_array_elements(v_indices) as x(value) loop
      if jsonb_typeof(v_index_json)<>'number' then raise exception 'Chỉ số đáp án AI phải là số nguyên'; end if;
      v_number:=(v_index_json #>> '{}')::numeric;
      if trunc(v_number)<>v_number or v_number<0 or v_number>3 then
        raise exception 'Chỉ số đáp án AI nằm ngoài phạm vi';
      end if;
      v_index:=v_number::integer;
      if v_index=any(v_indices_int) then raise exception 'Chỉ số đáp án AI bị lặp'; end if;
      v_indices_int:=array_append(v_indices_int,v_index);
    end loop;

    v_correct_answer:=null;
    if v_kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE') then
      if jsonb_array_length(v_options)<>4 then raise exception 'Câu trắc nghiệm AI phải có đúng 4 lựa chọn'; end if;
      if v_unique_option_count<>jsonb_array_length(v_options) then raise exception 'Lựa chọn trắc nghiệm AI bị trùng'; end if;
      if exists(select 1 from unnest(v_indices_int) as x(value) where x.value>=jsonb_array_length(v_options)) then
        raise exception 'Đáp án AI vượt quá số lựa chọn';
      end if;
      if v_kind='SINGLE_CHOICE' and cardinality(v_indices_int)<>1 then
        raise exception 'Câu một lựa chọn AI phải có đúng một đáp án';
      end if;
      if v_kind='MULTIPLE_CHOICE' and cardinality(v_indices_int)<2 then
        raise exception 'Câu nhiều lựa chọn AI cần ít nhất hai đáp án';
      end if;
      v_correct_answer:=to_jsonb(v_indices_int);
      if v_kind='SINGLE_CHOICE' then v_correct_answer:=to_jsonb(v_indices_int[1]); end if;
    elsif v_kind='TRUE_FALSE' then
      if cardinality(v_indices_int)<>1 or v_indices_int[1] not in (0,1) then
        raise exception 'Câu Đúng/Sai AI phải có một đáp án hợp lệ';
      end if;
      v_options:='["Đúng","Sai"]'::jsonb;
      v_correct_answer:=to_jsonb(v_indices_int[1]=0);
    else
      if jsonb_array_length(v_options)<>0 or cardinality(v_indices_int)<>0 or v_model_answer='' then
        raise exception 'Câu trả lời mở AI cần đáp án tham khảo và không có lựa chọn';
      end if;
      v_correct_answer:=to_jsonb(v_model_answer);
    end if;

    insert into public.ai_generation_outputs(request_id,content,kind,objective_id,difficulty,bloom_level,options,correct_answer)
    values (p_request,v_content,v_kind,v_objective,v_difficulty,v_bloom,v_options,v_correct_answer);
    v_count:=v_count+1;
  end loop;

  update public.ai_generation_requests
  set status='COMPLETED',completed_at=now(),error_message=null
  where id=p_request;
  perform public.notify_user(r.teacher_id,'AI_GENERATION_COMPLETED','AI đã tạo xong '||v_count||' câu hỏi nháp',
    'Bài học đã có bản nháp. Hãy duyệt trước khi đưa vào ngân hàng câu hỏi.',
    jsonb_build_object('page','ai','request_id',p_request));
  return v_count;
end;
$$;

revoke all on function public.save_ai_output(uuid,jsonb,text) from public,anon;
grant execute on function public.save_ai_output(uuid,jsonb,text) to authenticated;
