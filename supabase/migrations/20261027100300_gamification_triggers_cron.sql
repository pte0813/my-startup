-- 3단계 게이미피케이션 ④ 트리거·권한·크론 (이미 적용됨)
create trigger on_attendance_xp after insert or update of attendance on public.trip_applications
  for each row execute function public.trg_attendance_xp();
create trigger on_review_xp after insert on public.reviews
  for each row execute function public.trg_review_xp();
create trigger on_trip_past_host_xp after update of status on public.trips
  for each row when (new.status = 'past' and old.status is distinct from 'past') execute function public.trg_host_xp();
create trigger on_checkin_xp after insert on public.daily_checkins
  for each row execute function public.trg_checkin_xp();
create trigger on_crew_member_size before insert on public.crew_members
  for each row execute function public.trg_crew_size();

revoke all on function public.level_of(integer) from public;
revoke all on function public.issue_coupon(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.add_xp(uuid, text, text) from public, anon, authenticated;
revoke all on function public.remove_xp(uuid, text, text) from public, anon, authenticated;
revoke all on function public.award_titles(uuid) from public, anon, authenticated;
revoke all on function public.eval_boards(uuid) from public, anon, authenticated;
revoke all on function public.rotate_daily_question() from public, anon, authenticated;
revoke all on function public.trg_attendance_xp() from public, anon, authenticated;
revoke all on function public.trg_review_xp() from public, anon, authenticated;
revoke all on function public.trg_host_xp() from public, anon, authenticated;
revoke all on function public.trg_checkin_xp() from public, anon, authenticated;
revoke all on function public.trg_crew_size() from public, anon, authenticated;
grant execute on function public.level_of(integer) to anon, authenticated, service_role;

-- 매일 15:00 UTC(= 한국 시간 00:00)에 오늘의 질문 갱신 (Supabase Cron = pg_cron)
create extension if not exists pg_cron;
select cron.schedule('rotate-daily-question', '0 15 * * *', 'select public.rotate_daily_question()');
