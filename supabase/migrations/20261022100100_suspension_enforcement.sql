-- 정지(suspended)된 회원은 새로 신청·후기·제안·신고를 넣을 수 없게 한다 (정책 재작성, 로직은 기존과 같고 정지 확인만 추가)
create policy "정지 회원 제외 신청" on public.trip_applications as restrictive for insert to authenticated
  with check (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'suspended'));
create policy "정지 회원 제외 후기" on public.reviews as restrictive for insert to authenticated
  with check (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'suspended'));
create policy "정지 회원 제외 제안" on public.suggestions as restrictive for insert to authenticated
  with check (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'suspended'));
create policy "정지 회원 제외 신고" on public.reports as restrictive for insert to authenticated
  with check (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'suspended'));
