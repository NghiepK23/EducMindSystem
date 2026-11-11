-- Thông báo phát sinh từ hoạt động: bài nộp, chấm điểm bài tập, nội dung mới xuất bản, học sinh vào lớp.
-- Người dùng không tự tạo được thông báo (không có chính sách INSERT); chỉ các trigger dưới đây tạo.
-- Thông báo cho giáo viên được gộp theo từng bài tập / lớp và tự đánh dấu đã đọc khi không còn bài chờ chấm.

create function public.on_submission_notify() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a record;
  v_group text := 'assignment:'||new.assignment_id;
  v_payload jsonb;
begin
  select x.title,x.max_score,x.course_id,c.class_id,k.owner_teacher_id,k.name as class_name into a
  from public.assignments x
  join public.courses c on c.id=x.course_id
  join public.classes k on k.id=c.class_id
  where x.id=new.assignment_id;
  v_payload := jsonb_build_object('page','grading','class_id',a.class_id,'course_id',a.course_id,'assignment_id',new.assignment_id);

  if tg_op='INSERT' then
    perform public.notify_grouped(a.owner_teacher_id,'NEW_SUBMISSION',v_group,
      'Bài nộp mới: '||a.title,'bài nộp mới: '||a.title,'Lớp '||a.class_name,v_payload);
    return null;
  end if;

  -- Học sinh sửa bài đã nộp khi chưa được chấm.
  if new.score is null and (new.text_content is distinct from old.text_content or new.storage_path is distinct from old.storage_path) then
    perform public.notify_grouped(a.owner_teacher_id,'SUBMISSION_RESUBMITTED',v_group,
      'Bài nộp được cập nhật: '||a.title,'bài nộp được cập nhật: '||a.title,'Lớp '||a.class_name,v_payload);
  end if;

  -- Giáo viên chấm, sửa điểm hoặc sửa nhận xét.
  if new.score is not null and (new.score is distinct from old.score or new.feedback is distinct from old.feedback) then
    perform public.notify_grouped(new.student_id,'ASSIGNMENT_GRADED','submission:'||new.id,
      case when old.score is null then 'Bài tập đã có điểm: '
           when new.score is distinct from old.score then 'Điểm bài tập đã được cập nhật: '
           else 'Nhận xét bài tập đã được cập nhật: ' end||a.title,
      null,'Điểm: '||trim_scale(new.score)||'/'||trim_scale(a.max_score),
      jsonb_build_object('page','results','class_id',a.class_id,'course_id',a.course_id,'assignment_id',new.assignment_id,'submission_id',new.id));
  end if;

  -- Không còn bài nào chờ chấm: đánh dấu đã đọc thông báo bài nộp của giáo viên.
  if new.score is distinct from old.score
     and not exists(select 1 from public.assignment_submissions s where s.assignment_id=new.assignment_id and s.score is null) then
    update public.notifications set is_read=true,read_at=now()
    where user_id=a.owner_teacher_id and type in ('NEW_SUBMISSION','SUBMISSION_RESUBMITTED') and not is_read and payload->>'group'=v_group;
  end if;
  return null;
end $$;
create trigger educmind_submission_notify after insert or update on public.assignment_submissions
  for each row execute function public.on_submission_notify();

-- Báo cho học sinh của lớp về một nội dung vừa hiện với họ. Chỉ báo khi nội dung thật sự hiển thị được
-- (cùng điều kiện với chính sách đọc) và mỗi học sinh chỉ nhận một lần cho mỗi nội dung.
create function public.notify_content_item(p_kind text,p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  it record;
  v_type text;
  v_title text;
  v_key text;
  v_payload jsonb;
begin
  if p_kind='lesson' then
    select l.id,l.title,l.course_id,c.class_id,k.name as class_name into it
    from public.lessons l
    join public.course_topics tp on tp.id=l.topic_id
    join public.courses c on c.id=l.course_id
    join public.classes k on k.id=c.class_id
    where l.id=p_id and l.status='PUBLISHED' and l.deleted_at is null
      and tp.status='PUBLISHED' and tp.deleted_at is null and c.deleted_at is null and k.deleted_at is null;
    if not found then return; end if;
    v_type := 'NEW_LESSON_PUBLISHED'; v_title := 'Bài học mới: '||it.title; v_key := 'lesson_id';
    v_payload := jsonb_build_object('page','lessons','class_id',it.class_id,'course_id',it.course_id,'lesson_id',it.id);
  elsif p_kind='assignment' then
    select x.id,x.title,x.course_id,x.due_at,c.class_id,k.name as class_name into it
    from public.assignments x
    join public.courses c on c.id=x.course_id
    join public.classes k on k.id=c.class_id
    where x.id=p_id and x.status='PUBLISHED' and x.deleted_at is null and c.deleted_at is null and k.deleted_at is null
      and (x.topic_id is null or exists(select 1 from public.course_topics tp
                                        where tp.id=x.topic_id and tp.status='PUBLISHED' and tp.deleted_at is null))
      and (x.lesson_id is null or exists(select 1 from public.lessons l join public.course_topics tp on tp.id=l.topic_id
                                         where l.id=x.lesson_id and l.status='PUBLISHED' and l.deleted_at is null
                                           and tp.status='PUBLISHED' and tp.deleted_at is null));
    if not found then return; end if;
    v_type := 'NEW_ASSIGNMENT_PUBLISHED'; v_title := 'Bài tập mới: '||it.title; v_key := 'assignment_id';
    v_payload := jsonb_build_object('page','assignments','class_id',it.class_id,'course_id',it.course_id,'assignment_id',it.id,'due_at',it.due_at);
  elsif p_kind='assessment' then
    select x.id,x.title,x.course_id,x.open_at,x.close_at,c.class_id,k.name as class_name into it
    from public.assessments x
    join public.courses c on c.id=x.course_id
    join public.classes k on k.id=c.class_id
    where x.id=p_id and x.status='PUBLISHED' and x.deleted_at is null and c.deleted_at is null and k.deleted_at is null
      and (x.topic_id is null or exists(select 1 from public.course_topics tp
                                        where tp.id=x.topic_id and tp.status='PUBLISHED' and tp.deleted_at is null))
      and (x.lesson_id is null or exists(select 1 from public.lessons l join public.course_topics tp on tp.id=l.topic_id
                                         where l.id=x.lesson_id and l.status='PUBLISHED' and l.deleted_at is null
                                           and tp.status='PUBLISHED' and tp.deleted_at is null));
    if not found then return; end if;
    v_type := 'NEW_ASSESSMENT_PUBLISHED'; v_title := 'Bài kiểm tra mới: '||it.title; v_key := 'assessment_id';
    v_payload := jsonb_build_object('page','assessments','class_id',it.class_id,'course_id',it.course_id,'assessment_id',it.id,
                                    'open_at',it.open_at,'close_at',it.close_at);
  else
    return;
  end if;

  insert into public.notifications(user_id,type,title,content,payload)
  select m.student_id,v_type,v_title,'Lớp '||it.class_name,v_payload
  from public.class_members m
  where m.class_id=it.class_id
    and not exists(select 1 from public.notifications n
                   where n.user_id=m.student_id and n.type=v_type and n.payload->>v_key=p_id::text);
end $$;

-- Chủ đề, bài học, bài tập hoặc bài kiểm tra vừa chuyển sang xuất bản (hoặc được khôi phục).
-- Xuất bản chủ đề / bài học làm hiện cả nội dung bên trong đang ở trạng thái xuất bản, nên báo luôn các nội dung đó.
create function public.on_content_published() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r record;
begin
  if new.status<>'PUBLISHED' or new.deleted_at is not null then return null; end if;
  if tg_op='UPDATE' and old.status='PUBLISHED' and old.deleted_at is null then return null; end if;

  if tg_table_name='assignments' then
    perform public.notify_content_item('assignment',new.id);
  elsif tg_table_name='assessments' then
    perform public.notify_content_item('assessment',new.id);
  else
    for r in
      select l.id from public.lessons l
      where (tg_table_name='lessons' and l.id=new.id) or (tg_table_name='course_topics' and l.topic_id=new.id)
      order by l.display_order
    loop
      perform public.notify_content_item('lesson',r.id);
    end loop;
    for r in
      select x.id from public.assignments x
      where (tg_table_name='lessons' and x.lesson_id=new.id)
         or (tg_table_name='course_topics'
             and (x.topic_id=new.id or x.lesson_id in (select l.id from public.lessons l where l.topic_id=new.id)))
    loop
      perform public.notify_content_item('assignment',r.id);
    end loop;
    for r in
      select x.id from public.assessments x
      where (tg_table_name='lessons' and x.lesson_id=new.id)
         or (tg_table_name='course_topics'
             and (x.topic_id=new.id or x.lesson_id in (select l.id from public.lessons l where l.topic_id=new.id)))
    loop
      perform public.notify_content_item('assessment',r.id);
    end loop;
  end if;
  return null;
end $$;
create trigger educmind_topic_published after insert or update of status,deleted_at on public.course_topics
  for each row execute function public.on_content_published();
create trigger educmind_lesson_published after insert or update of status,deleted_at on public.lessons
  for each row execute function public.on_content_published();
create trigger educmind_assignment_published after insert or update of status,deleted_at on public.assignments
  for each row execute function public.on_content_published();
create trigger educmind_assessment_published after insert or update of status,deleted_at on public.assessments
  for each row execute function public.on_content_published();

-- Học sinh vào lớp: tự vào bằng mã lớp thì báo giáo viên; được giáo viên thêm thì báo học sinh.
create function public.on_class_member_added() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  k record;
begin
  select c.name,c.owner_teacher_id into k from public.classes c where c.id=new.class_id;
  if auth.uid() is not distinct from new.student_id then
    perform public.notify_grouped(k.owner_teacher_id,'CLASS_MEMBER_JOINED','class:'||new.class_id,
      'Học sinh mới vào lớp '||k.name,'học sinh mới vào lớp '||k.name,
      coalesce((select nullif(p.full_name,'') from public.profiles p where p.id=new.student_id),''),
      jsonb_build_object('page','students','class_id',new.class_id));
  else
    perform public.notify_user(new.student_id,'ADDED_TO_CLASS','Em đã được thêm vào lớp '||k.name,'',
      jsonb_build_object('page','dashboard','class_id',new.class_id));
  end if;
  return null;
end $$;
create trigger educmind_class_member_added after insert on public.class_members
  for each row execute function public.on_class_member_added();

revoke all on function
  public.on_submission_notify(),
  public.notify_content_item(text,uuid),
  public.on_content_published(),
  public.on_class_member_added()
from public,anon,authenticated;
