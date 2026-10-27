-- 2단계 신뢰와 매칭 데이터: 신뢰 점수(출석·노쇼·경고), 매너 칭찬과 배지, 알림 (기존 재만남 reunion_picks를 이어서 사용)

-- 1) 알림: 회원은 자기 알림을 읽고 "읽음" 표시만 할 수 있다. 만드는 것은 서버/트리거뿐 ----------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('reunion_match', 'manner_badge', 'trust_down')),
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "내 알림만 조회" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "내 알림만 읽음 처리" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) 배지: 회원은 자기 배지만 조회. 부여는 트리거(보안 정의자 함수)만 ----------------------------------
create table if not exists public.user_badges (
  user_id    uuid not null references auth.users (id) on delete cascade,
  badge      text not null check (badge in ('first_trip', 'reliable', 'punctual', 'warm', 'mood_maker', 'considerate')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;
create policy "내 배지만 조회" on public.user_badges for select to authenticated using (user_id = auth.uid());

-- 3) 매너 칭찬: 같은 지난 여행의 참가자가 서로에게 남긴다. 누가 남겼는지는 받는 사람에게 보이지 않는다(서버만 접근) ------
create table if not exists public.manner_tags (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  tag        text not null check (tag in ('punctual', 'warm', 'mood_maker', 'considerate')),
  created_at timestamptz not null default now(),
  unique (trip_id, from_user, to_user, tag),
  check (from_user <> to_user)
);
create index if not exists manner_tags_to on public.manner_tags (to_user, tag);
alter table public.manner_tags enable row level security;
revoke all on public.manner_tags from anon, authenticated;

-- 4) 신뢰 점수 = 80 + 3×출석 − 20×노쇼 − 5×경고, 0~100로 제한. 매번 처음부터 다시 계산하므로 취소·정정해도 중복 반영되지 않는다 ----
alter table public.profiles alter column trust_score set default 80;

create function public.recompute_trust(uid uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare att integer; ns integer; w integer; s integer;
begin
  select count(*) filter (where attendance = 'attended'), count(*) filter (where attendance = 'no_show')
    into att, ns from public.trip_applications where user_id = uid;
  select coalesce(warning_count, 0) into w from public.profiles where id = uid;
  s := greatest(0, least(100, 80 + 3 * att - 20 * ns - 5 * coalesce(w, 0)));
  update public.profiles set trust_score = s where id = uid;
  return s;
end $$;

-- 5) 배지 부여: 첫 여행(출석 1회), 믿음직한 참가자(출석 3회+노쇼 없음), 매너 칭찬 4종(서로 다른 2명 이상에게 받으면) --
create function public.award_badges(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare att integer; ns integer;
begin
  select count(*) filter (where attendance = 'attended'), count(*) filter (where attendance = 'no_show')
    into att, ns from public.trip_applications where user_id = uid;
  with want as (
    select 'first_trip'::text as badge where att >= 1
    union all select 'reliable' where att >= 3 and ns = 0
    union all select tag from public.manner_tags where to_user = uid group by tag having count(distinct from_user) >= 2
  ), ins as (
    insert into public.user_badges (user_id, badge) select uid, badge from want on conflict do nothing returning badge
  )
  insert into public.notifications (user_id, kind, data) select uid, 'manner_badge', jsonb_build_object('badge', badge) from ins;
  -- 노쇼가 생기면 '믿음직한 참가자'는 거둔다
  if ns > 0 then delete from public.user_badges where user_id = uid and badge = 'reliable'; end if;
end $$;

-- 6) 트리거: 출석/노쇼가 바뀌면 점수·배지를 다시 계산하고, 노쇼면 알림 ------------------------------------
create function public.trg_attendance_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recompute_trust(new.user_id);
  perform public.award_badges(new.user_id);
  if new.attendance = 'no_show' and (tg_op = 'INSERT' or old.attendance is distinct from 'no_show') then
    insert into public.notifications (user_id, kind, data) values (new.user_id, 'trust_down', jsonb_build_object('trip_id', new.trip_id, 'reason', 'no_show'));
  end if;
  return new;
end $$;
create trigger on_attendance_changed after insert or update of attendance on public.trip_applications
  for each row execute function public.trg_attendance_changed();

create function public.trg_warning_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recompute_trust(new.id);
  return new;
end $$;
create trigger on_warning_changed after update of warning_count on public.profiles
  for each row when (old.warning_count is distinct from new.warning_count) execute function public.trg_warning_changed();

create function public.trg_manner_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_badges(new.to_user);
  return new;
end $$;
create trigger on_manner_added after insert on public.manner_tags
  for each row execute function public.trg_manner_added();

-- 함수는 트리거에서만 실행한다(브라우저·익명 호출 차단)
revoke all on function public.recompute_trust(uuid) from public, anon, authenticated;
revoke all on function public.award_badges(uuid) from public, anon, authenticated;
revoke all on function public.trg_attendance_changed() from public, anon, authenticated;
revoke all on function public.trg_warning_changed() from public, anon, authenticated;
revoke all on function public.trg_manner_added() from public, anon, authenticated;
