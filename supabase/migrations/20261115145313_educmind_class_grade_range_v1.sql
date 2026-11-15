do $$
begin
  if exists (
    select 1
    from public.classes
    where grade is not null and grade not between 3 and 12
  ) then
    raise exception 'Cannot restrict class grades to 3–12 while classes with grades 1–2 exist'
      using hint = 'Update or clear the grade of affected classes, then rerun this migration.';
  end if;
end
$$;

alter table public.classes
  drop constraint if exists classes_grade_check;

alter table public.classes
  add constraint classes_grade_check
  check (grade is null or grade between 3 and 12);
