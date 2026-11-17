create function public.purge_trashed_item(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_course uuid;
  v_found boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  case p_type
    when 'topic' then
      select course_id into v_course from public.course_topics where id=p_id and deleted_at is not null for update;
    when 'lesson' then
      select course_id into v_course from public.lessons where id=p_id and deleted_at is not null for update;
    when 'assignment' then
      select course_id into v_course from public.assignments where id=p_id and deleted_at is not null for update;
    when 'question' then
      select course_id into v_course from public.questions where id=p_id and deleted_at is not null for update;
    else
      raise exception 'Unsupported trash item type' using errcode='22023';
  end case;
  v_found := found;

  if not v_found or not public.can_manage_course(v_course) then
    raise exception 'Trashed item is unavailable' using errcode='42501';
  end if;

  case p_type
    when 'topic' then
      if exists(select 1 from public.lessons where topic_id=p_id)
         or exists(select 1 from public.assignments where topic_id=p_id)
         or exists(select 1 from public.assessments where topic_id=p_id) then
        raise exception 'TRASH_ITEM_HAS_DEPENDENTS' using errcode='23503';
      end if;
      delete from public.course_topics where id=p_id and deleted_at is not null;
    when 'lesson' then
      if exists(select 1 from public.learning_objectives where lesson_id=p_id)
         or exists(select 1 from public.resources where lesson_id=p_id)
         or exists(select 1 from public.assignments where lesson_id=p_id)
         or exists(select 1 from public.assessments where lesson_id=p_id)
         or exists(select 1 from public.ai_generation_requests where lesson_id=p_id) then
        raise exception 'TRASH_ITEM_HAS_DEPENDENTS' using errcode='23503';
      end if;
      delete from public.lessons where id=p_id and deleted_at is not null;
    when 'assignment' then
      if exists(select 1 from public.assignment_questions where assignment_id=p_id)
         or exists(select 1 from public.assignment_objectives where assignment_id=p_id)
         or exists(select 1 from public.rubric_criteria where assignment_id=p_id)
         or exists(select 1 from public.assignment_submissions where assignment_id=p_id)
         or exists(select 1 from public.learning_evidence where source_type='ASSIGNMENT' and source_id=p_id) then
        raise exception 'TRASH_ITEM_HAS_DEPENDENTS' using errcode='23503';
      end if;
      delete from public.assignments where id=p_id and deleted_at is not null;
    when 'question' then
      if exists(select 1 from public.assignment_questions where question_id=p_id)
         or exists(select 1 from public.assessment_questions where question_id=p_id)
         or exists(select 1 from public.submission_answers where question_id=p_id)
         or exists(select 1 from public.assignment_submission_answers where question_id=p_id)
         or exists(select 1 from public.question_objectives where question_id=p_id)
         or exists(select 1 from public.ai_generation_outputs where approved_question_id=p_id) then
        raise exception 'TRASH_ITEM_HAS_DEPENDENTS' using errcode='23503';
      end if;
      delete from public.questions where id=p_id and deleted_at is not null;
  end case;

  if not found then
    raise exception 'Trashed item is unavailable' using errcode='42501';
  end if;
end $$;

revoke all on function public.purge_trashed_item(text,uuid) from public,anon,authenticated;
grant execute on function public.purge_trashed_item(text,uuid) to authenticated;
