-- Lịch sử chỉnh sửa nội dung và nhật ký điểm, ghi ở máy chủ.
-- Bản prototype lưu lịch sử trong localStorage của từng thiết bị. Từ nay mỗi thay đổi của giáo viên trên nội dung lớp
-- (chủ đề, bài học, mục tiêu, tài liệu, bài tập, rubric, câu hỏi, bài kiểm tra) và trên điểm số được trigger ghi vào
-- content_revisions kèm trạng thái trước / sau, nên giao diện không thể quên ghi và không thể ghi sai người sửa.
--   entity_type = tên bảng; entity_id = mã đối tượng (với bảng liên kết: mã bài tập / câu hỏi / bài kiểm tra / bài nộp)
--   action = CREATE | UPDATE | DELETE | SOFT_DELETE | RESTORE | PUBLISH | UNPUBLISH | GRADE
-- Không ghi: thao tác của học sinh, việc chấm tự động của hệ thống, và các dòng bị xóa kéo theo khi xóa đối tượng cha.

create function public.log_content_revision() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_class uuid;
  v_entity uuid;
  v_action text;
begin
  if auth.uid() is null or public.educmind_is_system() then return null; end if;
  if tg_op<>'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op<>'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new,v_old);

  -- Lớp và đối tượng mà thay đổi này thuộc về.
  if tg_table_name in ('course_topics','lessons','resources','assignments','assessments','questions') then
    v_entity := (v_row->>'id')::uuid;
    select c.class_id into v_class from public.courses c where c.id=(v_row->>'course_id')::uuid;
  elsif tg_table_name='learning_objectives' then
    v_entity := (v_row->>'id')::uuid;
    select c.class_id into v_class
    from public.lessons l join public.courses c on c.id=l.course_id
    where l.id=(v_row->>'lesson_id')::uuid;
  elsif tg_table_name in ('rubric_criteria','assignment_submissions') then
    v_entity := (v_row->>'id')::uuid;
    select c.class_id into v_class
    from public.assignments a join public.courses c on c.id=a.course_id
    where a.id=(v_row->>'assignment_id')::uuid;
  elsif tg_table_name='assignment_objectives' then
    v_entity := (v_row->>'assignment_id')::uuid;
    select c.class_id into v_class
    from public.assignments a join public.courses c on c.id=a.course_id
    where a.id=v_entity;
  elsif tg_table_name='rubric_scores' then
    v_entity := (v_row->>'submission_id')::uuid;
    select c.class_id into v_class
    from public.assignment_submissions s
    join public.assignments a on a.id=s.assignment_id
    join public.courses c on c.id=a.course_id
    where s.id=v_entity;
  elsif tg_table_name='question_objectives' then
    v_entity := (v_row->>'question_id')::uuid;
    select c.class_id into v_class
    from public.questions q join public.courses c on c.id=q.course_id
    where q.id=v_entity;
  elsif tg_table_name='assessment_questions' then
    v_entity := (v_row->>'assessment_id')::uuid;
    select c.class_id into v_class
    from public.assessments e join public.courses c on c.id=e.course_id
    where e.id=v_entity;
  elsif tg_table_name='submission_answers' then
    v_entity := (v_row->>'id')::uuid;
    select c.class_id into v_class
    from public.assessment_attempts t
    join public.assessments e on e.id=t.assessment_id
    join public.courses c on c.id=e.course_id
    where t.id=(v_row->>'attempt_id')::uuid;
  end if;

  -- Chỉ ghi thao tác của giáo viên quản lý lớp. Khi đối tượng cha đã bị xóa (xóa kéo theo) thì không tìm được lớp.
  if v_class is null or v_entity is null or not public.can_manage_class(v_class) then return null; end if;

  if tg_table_name in ('assignment_submissions','rubric_scores','submission_answers') then
    -- Nhật ký điểm: giữ các trường chấm điểm, không sao chép bài làm của học sinh.
    v_old := v_old-'text_content'-'storage_path'-'answer_content';
    v_new := v_new-'text_content'-'storage_path'-'answer_content';
    v_action := case when tg_op='DELETE' then 'DELETE' else 'GRADE' end;
  else
    v_action := case
      when tg_op='INSERT' then 'CREATE'
      when tg_op='DELETE' then 'DELETE'
      when (v_old->>'deleted_at') is null and (v_new->>'deleted_at') is not null then 'SOFT_DELETE'
      when (v_old->>'deleted_at') is not null and (v_new->>'deleted_at') is null then 'RESTORE'
      when (v_old->>'status') is distinct from (v_new->>'status') and (v_new->>'status')='PUBLISHED' then 'PUBLISH'
      when (v_old->>'status') is distinct from (v_new->>'status') and (v_new->>'status')='DRAFT' then 'UNPUBLISH'
      else 'UPDATE' end;
  end if;
  if tg_op='UPDATE' and v_old=v_new then return null; end if;

  insert into public.content_revisions(class_id,entity_type,entity_id,action,actor_id,before_state,after_state)
  values(v_class,tg_table_name,v_entity,v_action,auth.uid(),v_old,v_new);
  return null;
end $$;

create trigger educmind_revision_log after insert or update or delete on public.course_topics
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.lessons
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.learning_objectives
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.resources
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.assignments
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.rubric_criteria
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.assignment_objectives
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.questions
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.question_objectives
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.assessments
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.assessment_questions
  for each row execute function public.log_content_revision();
-- Nhật ký điểm.
create trigger educmind_revision_log after update of score,feedback or delete on public.assignment_submissions
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after insert or update or delete on public.rubric_scores
  for each row execute function public.log_content_revision();
create trigger educmind_revision_log after update of score,feedback on public.submission_answers
  for each row execute function public.log_content_revision();

revoke all on function public.log_content_revision() from public,anon,authenticated;
