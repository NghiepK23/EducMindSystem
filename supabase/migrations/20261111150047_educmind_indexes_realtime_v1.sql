-- Chỉ mục cho các khóa ngoại hay dùng để lọc (theo lớp, khóa học, bài học, học sinh, mục tiêu). Các chính sách RLS và
-- màn hình báo cáo đều tra theo những cột này; trước đây chỉ có chỉ mục khóa chính.
create index if not exists classes_owner_idx on public.classes(owner_teacher_id);
create index if not exists class_invites_class_idx on public.class_invites(class_id);
create index if not exists courses_class_idx on public.courses(class_id);
create index if not exists course_topics_course_idx on public.course_topics(course_id);
create index if not exists lessons_course_idx on public.lessons(course_id);
create index if not exists lessons_topic_idx on public.lessons(topic_id);
create index if not exists resources_course_idx on public.resources(course_id);
create index if not exists resources_lesson_idx on public.resources(lesson_id);
create index if not exists assignments_course_idx on public.assignments(course_id);
create index if not exists assignments_lesson_idx on public.assignments(lesson_id);
create index if not exists assignment_submissions_student_idx on public.assignment_submissions(student_id);
create index if not exists questions_course_idx on public.questions(course_id);
create index if not exists assessments_course_idx on public.assessments(course_id);
create index if not exists assessments_lesson_idx on public.assessments(lesson_id);
create index if not exists assessment_questions_question_idx on public.assessment_questions(question_id);
create index if not exists assessment_attempts_student_idx on public.assessment_attempts(student_id);
create index if not exists mastery_objective_idx on public.mastery(objective_id);
create index if not exists learning_evidence_objective_idx on public.learning_evidence(objective_id);
create index if not exists knowledge_gaps_objective_idx on public.knowledge_gaps(objective_id);
create index if not exists recommendations_objective_idx on public.recommendations(objective_id);
create index if not exists recommendations_assessment_idx on public.recommendations(assessment_id);
create index if not exists ai_generation_requests_teacher_idx on public.ai_generation_requests(teacher_id);
create index if not exists ai_generation_outputs_request_idx on public.ai_generation_outputs(request_id);

-- Thông báo theo thời gian thực: giao diện có thể đăng ký kênh Realtime của bảng notifications để cập nhật chuông
-- thông báo ngay khi có thay đổi. RLS vẫn áp dụng: mỗi người chỉ nhận thông báo của chính mình.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
