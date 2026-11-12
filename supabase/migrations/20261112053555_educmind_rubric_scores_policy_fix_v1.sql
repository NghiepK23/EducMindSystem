-- Sửa lỗi: không lưu được điểm rubric — chính sách rubric_scores_teacher_all viết
-- "exists(... and graded_by=auth.uid())" nhưng bên trong EXISTS, tên graded_by tham chiếu
-- cột graded_by của assignment_submissions (đang là null trước khi chấm) thay vì cột của
-- rubric_scores, nên with check luôn sai và mọi lần lưu điểm rubric đều bị từ chối.
-- Đưa điều kiện graded_by=auth.uid() ra ngoài EXISTS để tham chiếu đúng cột rubric_scores.

drop policy if exists rubric_scores_teacher_all on public.rubric_scores;
create policy rubric_scores_teacher_all on public.rubric_scores for all to authenticated
  using (exists(select 1 from public.assignment_submissions s
                where s.id = submission_id and public.can_manage_assignment(s.assignment_id)))
  with check (graded_by = auth.uid()
              and exists(select 1 from public.assignment_submissions s
                         where s.id = submission_id and public.can_manage_assignment(s.assignment_id)));
