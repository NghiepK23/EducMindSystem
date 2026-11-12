-- Nhóm 3 (bổ sung): câu hỏi cho trò chơi ôn tập.
-- Ngân hàng câu hỏi chỉ giáo viên đọc trực tiếp được (RLS question_teacher_all); học sinh chơi
-- trò chơi cần câu hỏi + đáp án để tự chấm — dùng RPC này, kèm hai ràng buộc an toàn:
--   - chỉ câu trắc nghiệm một đáp án của khóa học mình,
--   - KHÔNG lộ câu hỏi đang dùng cho bài kiểm tra chưa đóng (tránh "học tủ" đề chưa làm).
create function public.game_questions(p_course uuid)
returns table(id uuid, content text, kind text, options jsonb, correct_answer jsonb, objective_ids uuid[])
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.can_access_course(p_course) then
    raise exception 'Bạn không thuộc khóa học này';
  end if;
  return query
  select q.id, q.content, q.kind, q.options, q.correct_answer,
         coalesce(array_agg(qo.objective_id) filter (where qo.objective_id is not null), '{}') as objective_ids
  from public.questions q
  left join public.question_objectives qo on qo.question_id = q.id
  where q.course_id = p_course and q.deleted_at is null
    and q.kind in ('SINGLE_CHOICE','TRUE_FALSE')
    and q.correct_answer is not null
    and not exists (select 1 from public.assessment_questions aq
                    join public.assessments a on a.id = aq.assessment_id
                    where aq.question_id = q.id and a.deleted_at is null and a.close_at > now())
  group by q.id, q.content, q.kind, q.options, q.correct_answer;
end $$;

revoke all on function public.game_questions(uuid) from public, anon;
grant execute on function public.game_questions(uuid) to authenticated;
