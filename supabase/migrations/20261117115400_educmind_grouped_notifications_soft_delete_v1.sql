create or replace function public.notify_grouped(
  p_user uuid,
  p_type text,
  p_group text,
  p_title text,
  p_many_suffix text,
  p_content text default '',
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid;
  v_count integer;
begin
  if p_user is null then return; end if;
  select n.id,coalesce((n.payload->>'count')::integer,1) into v_id,v_count
  from public.notifications n
  where n.user_id=p_user and n.type=p_type and not n.is_read
    and n.deleted_at is null and n.payload->>'group'=p_group
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
