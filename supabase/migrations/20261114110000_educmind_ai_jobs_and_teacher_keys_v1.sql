-- Remove the application-level daily limit. Google Gemini remains responsible
-- for enforcing each teacher's project quota.
create or replace function public.create_ai_request(p_lesson uuid, p_quantity integer, p_parameters jsonb default '{}')
returns public.ai_generation_requests
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row public.ai_generation_requests;
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

  insert into public.ai_generation_requests(teacher_id,lesson_id,quantity,parameters)
  values(auth.uid(),p_lesson,p_quantity,coalesce(p_parameters,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_ai_request(uuid,integer,jsonb) from public,anon;
grant execute on function public.create_ai_request(uuid,integer,jsonb) to authenticated;

create table public.teacher_ai_credentials(
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  ciphertext text not null,
  nonce text not null,
  key_hint text not null check(length(key_hint)<=4),
  updated_at timestamptz not null default now()
);
alter table public.teacher_ai_credentials enable row level security;
revoke all on public.teacher_ai_credentials from public,anon,authenticated;
grant select,insert,update,delete on public.teacher_ai_credentials to service_role;

create table public.ai_generation_jobs(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ai_generation_requests(id) on delete cascade,
  ordinal integer not null check(ordinal>0),
  question_count integer not null check(question_count between 1 and 5),
  status text not null default 'QUEUED' check(status in ('QUEUED','PROCESSING','COMPLETED','FAILED')),
  error_message text,
  attempts integer not null default 0 check(attempts>=0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,ordinal)
);
create index ai_generation_jobs_request_status_idx on public.ai_generation_jobs(request_id,status,ordinal);
alter table public.ai_generation_jobs enable row level security;
create policy ai_generation_jobs_teacher_read on public.ai_generation_jobs
  for select to authenticated
  using(exists(
    select 1
    from public.ai_generation_requests r
    join public.lessons l on l.id=r.lesson_id
    where r.id=public.ai_generation_jobs.request_id
      and r.teacher_id=auth.uid() and public.can_manage_course(l.course_id)
  ));
grant select on public.ai_generation_jobs to authenticated;
grant select,insert,update,delete on public.ai_generation_jobs to service_role;

alter table public.ai_generation_outputs
  add column job_id uuid references public.ai_generation_jobs(id) on delete set null;
create index ai_generation_outputs_job_idx on public.ai_generation_outputs(job_id);
grant select,insert,update on public.ai_generation_outputs to service_role;

create or replace function public.enqueue_ai_generation(p_request uuid,p_retry boolean default false)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.ai_generation_requests%rowtype;
  v_count integer;
begin
  select * into r from public.ai_generation_requests where id=p_request for update;
  if not found then raise exception 'Không tìm thấy yêu cầu AI'; end if;
  if auth.uid() is null or public.current_app_role() is distinct from 'TEACHER'::public.app_role
     or r.teacher_id<>auth.uid()
     or not exists(select 1 from public.lessons l where l.id=r.lesson_id and public.can_manage_course(l.course_id)) then
    raise exception 'Only the requesting teacher can enqueue AI generation';
  end if;

  if p_retry then
    if r.status<>'FAILED' then raise exception 'Chỉ có thể thử lại yêu cầu đã thất bại'; end if;
    update public.ai_generation_jobs
    set status='QUEUED',error_message=null,started_at=null,completed_at=null,updated_at=now()
    where request_id=p_request and status='FAILED';
    update public.ai_generation_requests
    set status='PROCESSING',error_message=null,completed_at=null
    where id=p_request;
  elsif r.status not in ('PROCESSING','COMPLETED') then
    raise exception 'Yêu cầu AI này không thể tiếp tục';
  end if;
  if r.status='COMPLETED' and not p_retry then return 0; end if;

  insert into public.ai_generation_jobs(request_id,ordinal,question_count)
  select p_request,n,least(5,r.quantity-(n-1)*5)
  from generate_series(1,ceil(r.quantity/5.0)::integer) as n
  on conflict(request_id,ordinal) do nothing;

  select count(*)::integer into v_count
  from public.ai_generation_jobs
  where request_id=p_request and status in ('QUEUED','PROCESSING');
  return v_count;
end;
$$;

create or replace function public.claim_next_ai_generation_job(p_request uuid)
returns public.ai_generation_jobs
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_request_status text;
  v_job public.ai_generation_jobs;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;

  select status into v_request_status
  from public.ai_generation_requests
  where id=p_request
  for update;
  if not found or v_request_status<>'PROCESSING' then return null; end if;

  update public.ai_generation_jobs
  set status='QUEUED',started_at=null,updated_at=now()
  where request_id=p_request and status='PROCESSING'
    and (started_at is null or started_at<now()-interval '4 minutes');

  if exists(
    select 1 from public.ai_generation_jobs
    where request_id=p_request and status='PROCESSING'
  ) then
    return null;
  end if;

  select * into v_job
  from public.ai_generation_jobs
  where request_id=p_request and status='QUEUED'
  order by ordinal
  limit 1
  for update skip locked;
  if not found then return null; end if;

  update public.ai_generation_jobs
  set status='PROCESSING',attempts=attempts+1,started_at=now(),updated_at=now()
  where id=v_job.id
  returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.release_ai_generation_job(p_job uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;
  update public.ai_generation_jobs
  set status='QUEUED',started_at=null,updated_at=now()
  where id=p_job and status='PROCESSING';
  return found;
end;
$$;

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
      select array_agg(o.id order by o.code),count(*)::integer
      into v_allowed_ids,v_allowed_count
      from public.learning_objectives o
      where o.lesson_id=r.lesson_id
        and o.id::text in (select value #>> '{}' from jsonb_array_elements(v_selected) as x(value));
      if v_allowed_count<>jsonb_array_length(v_selected) then raise exception 'Một hoặc nhiều mục tiêu không thuộc bài học được chọn'; end if;
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
      if jsonb_typeof(v_options) is distinct from 'array' or jsonb_typeof(v_indices) is distinct from 'array' then
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
        if trunc(v_number)<>v_number or v_number<0 or v_number>3 then raise exception 'Chỉ số đáp án AI nằm ngoài phạm vi'; end if;
        v_index:=v_number::integer;
        if v_index=any(v_indices_int) then raise exception 'Chỉ số đáp án AI bị lặp'; end if;
        v_indices_int:=array_append(v_indices_int,v_index);
      end loop;

      v_correct_answer:=null;
      if v_kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE') then
        if jsonb_array_length(v_options)<>4 or v_unique_option_count<>jsonb_array_length(v_options) then
          raise exception 'Câu trắc nghiệm AI phải có đúng 4 lựa chọn không trùng';
        end if;
        if exists(select 1 from unnest(v_indices_int) as x(value) where x.value>=jsonb_array_length(v_options)) then
          raise exception 'Đáp án AI vượt quá số lựa chọn';
        end if;
        if v_kind='SINGLE_CHOICE' and cardinality(v_indices_int)<>1 then raise exception 'Câu một lựa chọn AI phải có đúng một đáp án'; end if;
        if v_kind='MULTIPLE_CHOICE' and cardinality(v_indices_int)<2 then raise exception 'Câu nhiều lựa chọn AI cần ít nhất hai đáp án'; end if;
        v_correct_answer:=to_jsonb(v_indices_int);
        if v_kind='SINGLE_CHOICE' then v_correct_answer:=to_jsonb(v_indices_int[1]); end if;
      elsif v_kind='TRUE_FALSE' then
        if cardinality(v_indices_int)<>1 or v_indices_int[1] not in (0,1) then raise exception 'Câu Đúng/Sai AI phải có một đáp án hợp lệ'; end if;
        v_options:='["Đúng","Sai"]'::jsonb;
        v_correct_answer:=to_jsonb(v_indices_int[1]=0);
      else
        if jsonb_array_length(v_options)<>0 or cardinality(v_indices_int)<>0 or v_model_answer='' then
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
          'Bài học đã có bản nháp. Hãy duyệt trước khi đưa vào ngân hàng câu hỏi.',
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

revoke all on function public.enqueue_ai_generation(uuid,boolean) from public,anon;
grant execute on function public.enqueue_ai_generation(uuid,boolean) to authenticated;
revoke all on function public.claim_next_ai_generation_job(uuid),
  public.release_ai_generation_job(uuid),
  public.complete_ai_generation_job(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_next_ai_generation_job(uuid),
  public.release_ai_generation_job(uuid),
  public.complete_ai_generation_job(uuid,jsonb,text) to service_role;
