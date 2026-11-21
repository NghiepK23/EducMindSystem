-- Mở game_questions cho các dạng câu chấm tự động: một/nhiều lựa chọn,
-- đúng/sai, điền khuyết và ghép đôi. Trả lời ngắn/tự luận không có đáp án
-- chuẩn để máy chấm nên không được đưa vào trò chơi.
-- CASE lồng nhau để chỉ gọi các hàm jsonb_array_* khi dữ liệu đúng kiểu.
drop function if exists public.game_questions(uuid);
create function public.game_questions(p_course uuid)
returns table(id uuid, content text, kind text, options jsonb, correct_answer jsonb, explain text, objective_ids uuid[])
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.can_access_course(p_course) then
    raise exception 'Bạn không thuộc khóa học này';
  end if;
  return query
  select q.id, q.content, q.kind, q.options, q.correct_answer, q.explain,
         coalesce(array_agg(qo.objective_id) filter (where qo.objective_id is not null), '{}') as objective_ids
  from public.questions q
  left join public.question_objectives qo on qo.question_id = q.id
  where q.course_id = p_course and q.deleted_at is null
    and q.correct_answer is not null
    and case q.kind
      when 'SINGLE_CHOICE' then
        case when jsonb_typeof(q.options) = 'array'
                  and jsonb_typeof(q.correct_answer) = 'number' then
          case when jsonb_array_length(q.options) >= 2 then
            (q.correct_answer #>> '{}')::numeric = trunc((q.correct_answer #>> '{}')::numeric)
            and (q.correct_answer #>> '{}')::numeric >= 0
            and (q.correct_answer #>> '{}')::numeric < jsonb_array_length(q.options)
          else false end
        else false end
      when 'MULTIPLE_CHOICE' then
        case when jsonb_typeof(q.options) = 'array'
                  and jsonb_typeof(q.correct_answer) = 'array' then
          case when jsonb_array_length(q.options) >= 2
                    and jsonb_array_length(q.correct_answer) >= 1 then
            not exists (
              select 1 from jsonb_array_elements(q.correct_answer) as answer(value)
              where case when jsonb_typeof(answer.value) = 'number' then
                (answer.value #>> '{}')::numeric <> trunc((answer.value #>> '{}')::numeric)
                or (answer.value #>> '{}')::numeric < 0
                or (answer.value #>> '{}')::numeric >= jsonb_array_length(q.options)
              else true end
            )
            and (select count(distinct value) from jsonb_array_elements(q.correct_answer) as answer(value))
                = jsonb_array_length(q.correct_answer)
          else false end
        else false end
      when 'TRUE_FALSE' then jsonb_typeof(q.correct_answer) = 'boolean'
      when 'FILL_IN_BLANK' then
        case when jsonb_typeof(q.correct_answer) = 'array' then
          case when jsonb_array_length(q.correct_answer) >= 1 then
            jsonb_array_length(q.correct_answer)
              = (select count(*) from regexp_matches(coalesce(q.content, ''), '_{3,}', 'g'))
            and not exists (
              select 1 from jsonb_array_elements(q.correct_answer) as answer(value)
              where jsonb_typeof(answer.value) <> 'string'
                or btrim(answer.value #>> '{}') = ''
            )
          else false end
        else false end
      when 'MATCHING' then
        case when jsonb_typeof(q.options) = 'object'
                  and jsonb_typeof(q.options->'left') = 'array'
                  and jsonb_typeof(q.options->'right') = 'array'
                  and jsonb_typeof(q.correct_answer) = 'array' then
          case when jsonb_array_length(q.options->'left') >= 2
                    and jsonb_array_length(q.options->'left') <= 20
                    and jsonb_array_length(q.options->'left') = jsonb_array_length(q.options->'right')
                    and jsonb_array_length(q.correct_answer) = jsonb_array_length(q.options->'left') then
            not exists (
              select 1 from jsonb_array_elements(q.options->'left') as item(value)
              where jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}') = ''
            )
            and not exists (
              select 1 from jsonb_array_elements(q.options->'right') as item(value)
              where jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}') = ''
            )
            and not exists (
              select 1 from jsonb_array_elements(q.correct_answer) as answer(value)
              where case when jsonb_typeof(answer.value) = 'number' then
                (answer.value #>> '{}')::numeric <> trunc((answer.value #>> '{}')::numeric)
                or (answer.value #>> '{}')::numeric < 0
                or (answer.value #>> '{}')::numeric >= jsonb_array_length(q.options->'right')
              else true end
            )
            and (select count(distinct value) from jsonb_array_elements(q.correct_answer) as answer(value))
                = jsonb_array_length(q.correct_answer)
          else false end
        else false end
      else false
    end
    and not exists (
      select 1 from public.assessment_questions aq
      join public.assessments a on a.id = aq.assessment_id
      where aq.question_id = q.id and a.deleted_at is null and a.close_at > now()
    )
  group by q.id, q.content, q.kind, q.options, q.correct_answer, q.explain;
end $$;

revoke all on function public.game_questions(uuid) from public, anon;
grant execute on function public.game_questions(uuid) to authenticated;
