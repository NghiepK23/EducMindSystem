-- Phân tích học tập phía máy chủ: bằng chứng -> mức nắm vững -> lỗ hổng kiến thức -> gợi ý học tập.
-- Quy tắc giữ nguyên như bản prototype (index.html):
--   mức nắm vững = trung bình có trọng số của các bằng chứng, trọng số = 0,5 ^ (tuổi tính theo ngày / 30)
--   mở lỗ hổng khi mức nắm vững < 50% và có từ 2 bằng chứng; đóng khi mức nắm vững >= 65%
--   gợi ý theo mức nắm vững: dưới 40% ôn lại nội dung, 40–69% luyện tập có mục tiêu, từ 70% hoạt động nâng cao
-- Người dùng không ghi trực tiếp các bảng này; chỉ trigger và hàm nội bộ (security definer) ghi.

alter table public.learning_evidence add column observed_at timestamptz not null default now();
create index learning_evidence_source_idx on public.learning_evidence(source_type,source_id);

alter table public.knowledge_gaps
  add column resolved_at timestamptz,
  add column dismissed_at timestamptz,
  add column evidence_signature text;
create unique index knowledge_gaps_one_open on public.knowledge_gaps(student_id,objective_id) where status='OPEN';
create index knowledge_gaps_pair_idx on public.knowledge_gaps(student_id,objective_id);

alter table public.recommendations add column assessment_id uuid references public.assessments(id) on delete cascade;
create index recommendations_pair_idx on public.recommendations(student_id,objective_id);

alter table public.notifications add column payload jsonb not null default '{}'::jsonb;
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);

-- Thông báo cho một người dùng. payload chứa trang đích và các mã liên quan để giao diện điều hướng.
create function public.notify_user(p_user uuid,p_type text,p_title text,p_content text default '',p_payload jsonb default '{}'::jsonb) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.notifications(user_id,type,title,content,payload)
  select p_user,p_type,p_title,coalesce(p_content,''),coalesce(p_payload,'{}'::jsonb)
  where p_user is not null
$$;

-- Thông báo gộp: nếu người dùng còn một thông báo CHƯA ĐỌC cùng loại và cùng nhóm thì cập nhật thông báo đó
-- thay vì tạo thêm. p_many_suffix khác null: cộng dồn số lượng ("3 bài nộp mới: ..."); null: chỉ thay nội dung.
create function public.notify_grouped(p_user uuid,p_type text,p_group text,p_title text,p_many_suffix text,p_content text default '',p_payload jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid;
  v_count integer;
begin
  if p_user is null then return; end if;
  select n.id,coalesce((n.payload->>'count')::integer,1) into v_id,v_count
  from public.notifications n
  where n.user_id=p_user and n.type=p_type and not n.is_read and n.payload->>'group'=p_group
  order by n.created_at desc limit 1 for update;
  if v_id is null then
    insert into public.notifications(user_id,type,title,content,payload)
    values(p_user,p_type,p_title,coalesce(p_content,''),coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('group',p_group,'count',1));
    return;
  end if;
  if p_many_suffix is not null then v_count := v_count+1; end if;
  update public.notifications
  set title=case when p_many_suffix is null then p_title else v_count||' '||p_many_suffix end,
      content=coalesce(p_content,''),
      payload=coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('group',p_group,'count',v_count),
      created_at=now()
  where id=v_id;
end $$;

-- Chữ ký tập bằng chứng của một cặp (học sinh, mục tiêu): đổi khi thêm, bớt bằng chứng hoặc đổi điểm.
create function public.evidence_signature(p_student uuid,p_objective uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
  select md5(coalesce(string_agg(e.source_type||':'||e.source_id||':'||round(e.score,4),'|' order by e.source_type,e.source_id),''))
  from public.learning_evidence e
  where e.student_id=p_student and e.objective_id=p_objective
$$;

-- Gợi ý theo mức nắm vững của một cặp (học sinh, mục tiêu). Mỗi cặp có tối đa một gợi ý còn hiệu lực.
-- Khi mức nắm vững sang khoảng khác, gợi ý cũ chuyển COMPLETED và gợi ý mới được tạo kèm thông báo.
-- Gợi ý học sinh đã bỏ qua không được tạo lại chừng nào mức nắm vững còn ở cùng khoảng.
create function public.sync_objective_recommendation(p_student uuid,p_objective uuid,p_score numeric) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c_kinds constant text[] := array['REVIEW_CONTENT','TARGETED_PRACTICE','ADVANCED_ACTIVITY'];
  v_kind text;
  v_label text;
  v_reason text;
  v_has boolean;
  v_id uuid;
  r public.recommendations%rowtype;
  o record;
begin
  if p_score<0.4 then
    v_kind := 'REVIEW_CONTENT'; v_label := 'Ôn lại nội dung';
    v_reason := 'Mức nắm vững '||round(p_score*100)||'% (dưới 40%)';
  elsif p_score<0.7 then
    v_kind := 'TARGETED_PRACTICE'; v_label := 'Luyện tập có mục tiêu';
    v_reason := 'Mức nắm vững '||round(p_score*100)||'% (40–69%)';
  else
    v_kind := 'ADVANCED_ACTIVITY'; v_label := 'Hoạt động nâng cao';
    v_reason := 'Mức nắm vững '||round(p_score*100)||'% (từ 70%)';
  end if;

  select x.* into r from public.recommendations x
  where x.student_id=p_student and x.objective_id=p_objective and x.kind=any(c_kinds)
  order by x.created_at desc limit 1;
  v_has := found;

  if v_has and r.kind=v_kind and r.status<>'COMPLETED' then
    if r.status in ('ACTIVE','ACCEPTED') and r.reason is distinct from v_reason then
      update public.recommendations set reason=v_reason where id=r.id;
    end if;
    return;
  end if;

  update public.recommendations set status='COMPLETED',responded_at=coalesce(responded_at,clock_timestamp())
  where student_id=p_student and objective_id=p_objective and kind=any(c_kinds) and status in ('ACTIVE','ACCEPTED');

  insert into public.recommendations(student_id,objective_id,kind,reason,status,created_at)
  values(p_student,p_objective,v_kind,v_reason,'ACTIVE',clock_timestamp())
  returning id into v_id;

  select ob.code,ob.description,l.id as lesson_id,l.course_id,c.class_id into o
  from public.learning_objectives ob
  join public.lessons l on l.id=ob.lesson_id
  join public.courses c on c.id=l.course_id
  where ob.id=p_objective;

  perform public.notify_user(p_student,'NEW_RECOMMENDATION','Gợi ý học tập: '||v_label,
    o.code||' · '||o.description||'. '||v_reason||'.',
    jsonb_build_object('page','recommend','class_id',o.class_id,'course_id',o.course_id,'lesson_id',o.lesson_id,
                       'objective_id',p_objective,'recommendation_id',v_id,'kind',v_kind));
end $$;

-- Tính lại mức nắm vững của một cặp (học sinh, mục tiêu), rồi mở / đóng lỗ hổng và cập nhật gợi ý.
create function public.recalc_mastery(p_student uuid,p_objective uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c_half_life_days constant numeric := 30;   -- chu kỳ bán rã của bằng chứng (ngày)
  c_open constant numeric := 0.5;            -- mở lỗ hổng khi mức nắm vững < 50%
  c_close constant numeric := 0.65;          -- đóng lỗ hổng khi mức nắm vững >= 65%
  c_min_evidence constant integer := 2;      -- cần ít nhất 2 bằng chứng mới mở lỗ hổng
  v_score numeric;
  v_count integer;
  v_sig text;
  v_has_gap boolean;
  g public.knowledge_gaps%rowtype;
begin
  -- Khóa theo cặp để hai lượt chấm đồng thời không ghi đè nhau.
  perform pg_advisory_xact_lock(hashtextextended(p_student::text||':'||p_objective::text,0));

  -- Tuổi tính từ bằng chứng mới nhất. Nhân mọi trọng số với cùng một hệ số không làm đổi trung bình
  -- có trọng số, nên kết quả bằng đúng công thức 0,5^((hôm nay - ngày)/30) của prototype và
  -- không cần tính lại định kỳ khi thời gian trôi.
  select sum(t.w*t.score)/nullif(sum(t.w),0),count(*) into v_score,v_count
  from (
    select e.score,
           power(0.5::numeric,extract(epoch from (max(e.observed_at) over ()-e.observed_at))/86400.0/c_half_life_days) as w
    from public.learning_evidence e
    where e.student_id=p_student and e.objective_id=p_objective
  ) t;
  v_sig := public.evidence_signature(p_student,p_objective);

  if coalesce(v_count,0)=0 then
    -- Không còn bằng chứng: bỏ mức nắm vững, đóng lỗ hổng và gợi ý còn hiệu lực của cặp này.
    delete from public.mastery where student_id=p_student and objective_id=p_objective;
    update public.knowledge_gaps
    set status='DISMISSED',dismissed_at=clock_timestamp(),dismiss_reason='Không còn bằng chứng học tập',evidence_signature=v_sig
    where student_id=p_student and objective_id=p_objective and status='OPEN';
    update public.recommendations set status='COMPLETED',responded_at=coalesce(responded_at,clock_timestamp())
    where student_id=p_student and objective_id=p_objective and status in ('ACTIVE','ACCEPTED');
    return;
  end if;

  v_score := round(least(greatest(v_score,0),1),4);
  insert into public.mastery(student_id,objective_id,mastery_score,evidence_count,updated_at)
  values(p_student,p_objective,v_score,v_count,now())
  on conflict(student_id,objective_id) do update
    set mastery_score=excluded.mastery_score,evidence_count=excluded.evidence_count,updated_at=excluded.updated_at;

  -- Trạng thái lỗ hổng hiện tại của cặp: dòng đang mở; nếu không có thì dòng đóng gần nhất.
  select k.* into g from public.knowledge_gaps k
  where k.student_id=p_student and k.objective_id=p_objective
  order by (k.status='OPEN') desc,coalesce(k.dismissed_at,k.resolved_at,k.opened_at) desc
  limit 1;
  v_has_gap := found;

  if v_has_gap and g.status='OPEN' then
    if v_score>=c_close then
      update public.knowledge_gaps set status='RESOLVED',resolved_at=clock_timestamp() where id=g.id;
      update public.recommendations set status='COMPLETED',responded_at=coalesce(responded_at,clock_timestamp())
      where student_id=p_student and objective_id=p_objective and kind='RETAKE_ASSESSMENT' and status in ('ACTIVE','ACCEPTED');
    end if;
  elsif v_score<c_open and v_count>=c_min_evidence
        and not (v_has_gap and g.status='DISMISSED' and g.evidence_signature is not distinct from v_sig) then
    -- Lỗ hổng đã bị bỏ qua chỉ mở lại khi bằng chứng thay đổi so với lúc bỏ qua.
    insert into public.knowledge_gaps(student_id,objective_id,status,reason,opened_at)
    values(p_student,p_objective,'OPEN','Mức nắm vững '||round(v_score*100)||'% với '||v_count||' bằng chứng',clock_timestamp());
  end if;

  perform public.sync_objective_recommendation(p_student,p_objective,v_score);
end $$;

-- Ghi (hoặc cập nhật) một bằng chứng rồi tính lại. p_touch: làm mới ngày ghi nhận kể cả khi điểm không đổi.
create function public.record_evidence(p_student uuid,p_objective uuid,p_source_type text,p_source_id uuid,p_score numeric,p_touch boolean default true) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.learning_evidence as le(student_id,objective_id,source_type,source_id,score,observed_at)
  values(p_student,p_objective,p_source_type,p_source_id,round(least(greatest(coalesce(p_score,0),0),1),4),now())
  on conflict(student_id,objective_id,source_type,source_id) do update
    set score=excluded.score,observed_at=excluded.observed_at
    where p_touch or le.score is distinct from excluded.score;
  perform public.recalc_mastery(p_student,p_objective);
end $$;

-- Xóa bằng chứng của một nguồn (gỡ điểm, xóa bài nộp, gỡ liên kết mục tiêu) rồi tính lại các cặp bị ảnh hưởng.
create function public.clear_evidence(p_source_type text,p_source_id uuid,p_student uuid default null,p_objective uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r record;
begin
  for r in
    delete from public.learning_evidence e
    where e.source_type=p_source_type and e.source_id=p_source_id
      and (p_student is null or e.student_id=p_student)
      and (p_objective is null or e.objective_id=p_objective)
    returning e.student_id,e.objective_id
  loop
    perform public.recalc_mastery(r.student_id,r.objective_id);
  end loop;
end $$;

-- Chấm điểm bài tập -> bằng chứng (điểm / điểm tối đa) cho từng mục tiêu gắn với bài tập.
create function public.sync_assignment_evidence() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_max numeric;
  r record;
begin
  if tg_op='DELETE' then
    perform public.clear_evidence('ASSIGNMENT',old.assignment_id,old.student_id);
    return null;
  end if;
  if tg_op='UPDATE' and new.score is not distinct from old.score then return null; end if;
  if new.score is null then
    if tg_op='UPDATE' then perform public.clear_evidence('ASSIGNMENT',new.assignment_id,new.student_id); end if;
    return null;
  end if;
  select max_score into v_max from public.assignments where id=new.assignment_id;
  for r in select ao.objective_id from public.assignment_objectives ao where ao.assignment_id=new.assignment_id loop
    perform public.record_evidence(new.student_id,r.objective_id,'ASSIGNMENT',new.assignment_id,new.score/v_max);
  end loop;
  return null;
end $$;
create trigger educmind_submission_evidence after insert or update of score or delete on public.assignment_submissions
  for each row execute function public.sync_assignment_evidence();

-- Gắn / gỡ mục tiêu của bài tập sau khi đã chấm -> đồng bộ lại bằng chứng.
create function public.sync_assignment_objective_link() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_max numeric;
  r record;
begin
  if tg_op in ('UPDATE','DELETE') then
    perform public.clear_evidence('ASSIGNMENT',old.assignment_id,null,old.objective_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select max_score into v_max from public.assignments where id=new.assignment_id;
    for r in select s.student_id,s.score from public.assignment_submissions s
             where s.assignment_id=new.assignment_id and s.score is not null loop
      perform public.record_evidence(r.student_id,new.objective_id,'ASSIGNMENT',new.assignment_id,r.score/v_max);
    end loop;
  end if;
  return null;
end $$;
create trigger educmind_assignment_objective_sync after insert or update or delete on public.assignment_objectives
  for each row execute function public.sync_assignment_objective_link();

-- Đổi điểm tối đa của bài tập: không được thấp hơn điểm đã chấm; bằng chứng được tính lại theo thang mới.
create function public.sync_assignment_max_score() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r record;
begin
  if new.max_score is not distinct from old.max_score then return null; end if;
  if exists(select 1 from public.assignment_submissions s where s.assignment_id=new.id and s.score>new.max_score) then
    raise exception 'Max score is lower than an existing score';
  end if;
  for r in select s.student_id,s.score,ao.objective_id
           from public.assignment_submissions s
           join public.assignment_objectives ao on ao.assignment_id=s.assignment_id
           where s.assignment_id=new.id and s.score is not null loop
    perform public.record_evidence(r.student_id,r.objective_id,'ASSIGNMENT',new.id,r.score/new.max_score,false);
  end loop;
  return null;
end $$;
create trigger educmind_assignment_max_score_sync after update of max_score on public.assignments
  for each row execute function public.sync_assignment_max_score();

-- Giáo viên bỏ qua một lỗ hổng đang mở (kèm lý do). Lưu chữ ký bằng chứng để chỉ mở lại khi bằng chứng thay đổi.
create function public.dismiss_knowledge_gap(p_gap uuid,p_reason text default null) returns public.knowledge_gaps
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v public.knowledge_gaps%rowtype;
begin
  select g.* into v from public.knowledge_gaps g where g.id=p_gap for update;
  if not found or not exists(
    select 1 from public.learning_objectives o
    join public.lessons l on l.id=o.lesson_id
    join public.courses c on c.id=l.course_id
    join public.class_members m on m.class_id=c.class_id and m.student_id=v.student_id
    where o.id=v.objective_id and public.can_manage_class(c.class_id)
  ) then
    raise exception 'Knowledge gap not found';
  end if;
  if v.status<>'OPEN' then raise exception 'Only an open knowledge gap can be dismissed'; end if;
  update public.knowledge_gaps
  set status='DISMISSED',dismissed_by=auth.uid(),dismiss_reason=nullif(btrim(coalesce(p_reason,'')),''),
      dismissed_at=clock_timestamp(),evidence_signature=public.evidence_signature(v.student_id,v.objective_id)
  where id=p_gap
  returning * into v;
  update public.recommendations set status='COMPLETED',responded_at=coalesce(responded_at,clock_timestamp())
  where student_id=v.student_id and objective_id=v.objective_id and kind='RETAKE_ASSESSMENT' and status in ('ACTIVE','ACCEPTED');
  return v;
end $$;

-- Học sinh chỉ phản hồi được gợi ý còn hiệu lực (đồng ý hoặc bỏ qua); gợi ý đã đóng không mở lại được.
alter policy recommendation_respond on public.recommendations
  using (student_id=auth.uid() and status in ('ACTIVE','ACCEPTED'))
  with check (student_id=auth.uid() and status in ('ACCEPTED','DISMISSED'));

revoke all on function
  public.notify_user(uuid,text,text,text,jsonb),
  public.notify_grouped(uuid,text,text,text,text,text,jsonb),
  public.evidence_signature(uuid,uuid),
  public.sync_objective_recommendation(uuid,uuid,numeric),
  public.recalc_mastery(uuid,uuid),
  public.record_evidence(uuid,uuid,text,uuid,numeric,boolean),
  public.clear_evidence(text,uuid,uuid,uuid),
  public.sync_assignment_evidence(),
  public.sync_assignment_objective_link(),
  public.sync_assignment_max_score()
from public,anon,authenticated;
revoke all on function public.dismiss_knowledge_gap(uuid,text) from public,anon;
grant execute on function public.dismiss_knowledge_gap(uuid,text) to authenticated;
