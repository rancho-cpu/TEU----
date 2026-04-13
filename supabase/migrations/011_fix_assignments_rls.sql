-- ============================================================
-- Fix: assignments INSERT was blocked (missing WITH CHECK)
-- ============================================================
drop policy if exists "assignments_admin_write" on public.assignments;

create policy "assignments_admin_insert" on public.assignments
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "assignments_admin_update" on public.assignments
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "assignments_admin_delete" on public.assignments
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
