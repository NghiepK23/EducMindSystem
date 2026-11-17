create function public.trash_item_dependencies(p_type text, p_id uuid)
returns table(dependency_key text, label text, item_count bigint, preserves_history boolean, impact text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_course uuid;
  v_found boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  case p_type
    when 'topic' then
      select course_id into v_course from public.course_topics where id=p_id and deleted_at is not null;
    when 'lesson' then
      select course_id into v_course from public.lessons where id=p_id and deleted_at is not null;
    when 'assignment' then
      select course_id into v_course from public.assignments where id=p_id and deleted_at is not null;
    when 'question' then
      select course_id into v_course from public.questions where id=p_id and deleted_at is not null;
    else
      raise exception 'Unsupported trash item type' using errcode='22023';
  end case;
  v_found := found;

  if not v_found or not public.can_manage_course(v_course) then
    raise exception 'Trashed item is unavailable' using errcode='42501';
  end if;

  case p_type
    when 'topic' then
      return query
        select 'lessons', 'Bài học', count(*), false, 'Cần xử lý các bài học liên kết trước.'
        from public.lessons where topic_id=p_id
      union all
        select 'assignments', 'Bài tập', count(*), false, 'Cần xử lý các bài tập liên kết trước.'
        from public.assignments where topic_id=p_id
      union all
        select 'assessments', 'Bài kiểm tra', count(*), false, 'Cần xử lý các bài kiểm tra liên kết trước.'
        from public.assessments where topic_id=p_id;
    when 'lesson' then
      return query
        select 'learning_objectives', 'Mục tiêu học tập', count(*), false, 'Mục tiêu có thể được dùng trong bài nộp hoặc bằng chứng học tập; hãy kiểm tra các liên kết trước.'
        from public.learning_objectives where lesson_id=p_id
      union all
        select 'resources', 'Tài liệu đính kèm', count(*), false, 'Cần xử lý tài liệu đính kèm trước.'
        from public.resources where lesson_id=p_id
      union all
        select 'assignments', 'Bài tập', count(*), false, 'Cần xử lý các bài tập liên kết trước.'
        from public.assignments where lesson_id=p_id
      union all
        select 'assessments', 'Bài kiểm tra', count(*), false, 'Cần xử lý các bài kiểm tra liên kết trước.'
        from public.assessments where lesson_id=p_id
      union all
        select 'ai_generation_requests', 'Lịch sử yêu cầu AI', count(*), true, 'Lịch sử tạo nội dung được giữ nguyên.'
        from public.ai_generation_requests where lesson_id=p_id;
    when 'assignment' then
      return query
        select 'assignment_questions', 'Liên kết câu hỏi', count(*), false, 'Cần xử lý liên kết câu hỏi trước.'
        from public.assignment_questions where assignment_id=p_id
      union all
        select 'assignment_objectives', 'Liên kết mục tiêu học tập', count(*), false, 'Cần xử lý liên kết mục tiêu học tập trước.'
        from public.assignment_objectives where assignment_id=p_id
      union all
        select 'rubric_criteria', 'Tiêu chí chấm điểm', count(*), false, 'Cần xử lý tiêu chí chấm điểm trước.'
        from public.rubric_criteria where assignment_id=p_id
      union all
        select 'assignment_submissions', 'Bài nộp của học sinh', count(*), true, 'Bài nộp và kết quả chấm được giữ nguyên.'
        from public.assignment_submissions where assignment_id=p_id
      union all
        select 'learning_evidence', 'Bằng chứng học tập', count(*), true, 'Bằng chứng học tập được giữ nguyên để bảo toàn kết quả.'
        from public.learning_evidence where source_type='ASSIGNMENT' and source_id=p_id;
    when 'question' then
      return query
        select 'assignment_questions', 'Bài tập đang dùng câu hỏi', count(*), false, 'Cần gỡ câu hỏi khỏi các bài tập liên kết trước.'
        from public.assignment_questions where question_id=p_id
      union all
        select 'assessment_questions', 'Bài kiểm tra đang dùng câu hỏi', count(*), false, 'Cần gỡ câu hỏi khỏi các bài kiểm tra liên kết trước.'
        from public.assessment_questions where question_id=p_id
      union all
        select 'submission_answers', 'Câu trả lời trong bài kiểm tra', count(*), true, 'Câu trả lời và điểm được giữ nguyên.'
        from public.submission_answers where question_id=p_id
      union all
        select 'assignment_submission_answers', 'Câu trả lời trong bài tập', count(*), true, 'Câu trả lời của học sinh được giữ nguyên.'
        from public.assignment_submission_answers where question_id=p_id
      union all
        select 'question_objectives', 'Liên kết mục tiêu học tập', count(*), false, 'Cần xử lý liên kết mục tiêu học tập trước.'
        from public.question_objectives where question_id=p_id
      union all
        select 'ai_generation_outputs', 'Lịch sử câu hỏi được AI duyệt', count(*), true, 'Lịch sử tạo và duyệt câu hỏi được giữ nguyên.'
        from public.ai_generation_outputs where approved_question_id=p_id;
  end case;
end
$$;

revoke all on function public.trash_item_dependencies(text,uuid) from public,anon,authenticated;
grant execute on function public.trash_item_dependencies(text,uuid) to authenticated;
