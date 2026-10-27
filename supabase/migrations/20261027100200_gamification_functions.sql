-- 3단계 게이미피케이션 ③ 함수와 트리거 함수 (이미 적용됨). 함수는 트리거·서버(service_role)만 실행한다.
-- 레벨: 필요한 XP = 100 × L × (L−1) / 2 (Lv2=100, Lv3=300, Lv4=600, Lv5=1000 …)
create function public.level_of(x integer) returns integer
language sql immutable set search_path = '' as $$ select floor((1 + sqrt(1 + 8 * x / 100.0)) / 2)::integer $$;

-- 쿠폰 발급(같은 출처·기준값은 한 번만) + 알림
create function public.issue_coupon(uid uuid, tpl uuid, src text, ref text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; days integer;
begin
  select valid_days into days from public.coupon_templates where id = tpl and active;
  if days is null then return null; end if;
  insert into public.user_coupons (user_id, template_id, source, source_ref, expires_at)
    values (uid, tpl, src, ref, now() + make_interval(days => days)) on conflict do nothing returning id into cid;
  if cid is not null then
    insert into public.notifications (user_id, kind, data) values (uid, 'coupon', jsonb_build_object('template_id', tpl, 'source', src));
  end if;
  return cid;
end $$;

-- XP 적립: (회원, 종류, 기준값)이 같으면 한 번만. 레벨이 오르면 알림과 레벨 보상 쿠폰
create function public.add_xp(uid uuid, k text, r text) returns void
language plpgsql security definer set search_path = '' as $$
declare v integer; total integer; lv_before integer; lv_after integer; lvl integer; tpl uuid;
begin
  select x.xp into v from public.xp_rules x where x.kind = k and x.active;
  if coalesce(v, 0) <= 0 then return; end if;
  insert into public.xp_events (user_id, kind, ref, xp) values (uid, k, r, v) on conflict do nothing;
  if not found then return; end if;
  select p.xp into total from public.profiles p where p.id = uid;
  lv_before := public.level_of(coalesce(total, 0));
  update public.profiles set xp = coalesce((select sum(e.xp) from public.xp_events e where e.user_id = uid), 0) where id = uid returning profiles.xp into total;
  lv_after := public.level_of(coalesce(total, 0));
  if lv_after > lv_before then
    insert into public.notifications (user_id, kind, data) values (uid, 'level_up', jsonb_build_object('level', lv_after));
    for lvl in (lv_before + 1) .. lv_after loop
      select lr.coupon_template_id into tpl from public.level_rewards lr where lr.level = lvl;
      if tpl is not null then perform public.issue_coupon(uid, tpl, 'level', 'L' || lvl); end if;
    end loop;
  end if;
end $$;

-- XP 회수(출석을 취소·정정한 경우)
create function public.remove_xp(uid uuid, k text, r text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.xp_events where user_id = uid and kind = k and ref = r;
  if found then
    update public.profiles set xp = coalesce((select sum(e.xp) from public.xp_events e where e.user_id = uid), 0) where id = uid;
  end if;
end $$;

-- 관심사별 칭호: 같은 관심사 태그가 붙은 모임에 2번 이상 출석하면
create function public.award_titles(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  with ins as (
    insert into public.user_titles (user_id, interest)
    select uid, x.tag from (
      select unnest(t.tags) as tag from public.trip_applications a join public.trips t on t.id = a.trip_id
      where a.user_id = uid and a.attendance = 'attended'
    ) x group by x.tag having count(*) >= 2
    on conflict do nothing returning interest
  )
  insert into public.notifications (user_id, kind, data) select uid, 'title', jsonb_build_object('interest', ins.interest) from ins;
end $$;

-- 도장판: 출석한 모임의 지역(region) 또는 태그(tag) 종류가 목표 개수에 도달하면 쿠폰(한 번만)
create function public.eval_boards(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b record; n integer;
begin
  for b in select * from public.stamp_boards where active loop
    if exists (select 1 from public.user_board_rewards w where w.user_id = uid and w.board_id = b.id) then continue; end if;
    if b.kind = 'region' then
      select count(distinct t.region) into n from public.trip_applications a join public.trips t on t.id = a.trip_id
        where a.user_id = uid and a.attendance = 'attended' and t.region <> 'other';
    else
      select count(distinct x.tag) into n from (
        select unnest(t.tags) as tag from public.trip_applications a join public.trips t on t.id = a.trip_id
        where a.user_id = uid and a.attendance = 'attended'
      ) x;
    end if;
    if n >= b.goal then
      insert into public.user_board_rewards (user_id, board_id) values (uid, b.id) on conflict do nothing;
      if b.coupon_template_id is not null then perform public.issue_coupon(uid, b.coupon_template_id, 'stamp', b.id::text); end if;
    end if;
  end loop;
end $$;

-- 오늘(KST)의 질문 채우기: 가장 오래 안 쓴 질문을 고른다. 크론이 매일 자정(KST)에 부르고, 서버가 비어 있으면 대신 부른다
create function public.rotate_daily_question() returns date
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Asia/Seoul')::date; q record;
begin
  if exists (select 1 from public.daily_questions where day = d) then return d; end if;
  select * into q from public.question_bank where active order by last_used_on nulls first, random() limit 1;
  if q.id is null then return null; end if;
  insert into public.daily_questions (day, bank_id, question, a, b) values (d, q.id, q.question, q.a, q.b) on conflict do nothing;
  update public.question_bank set last_used_on = d where id = q.id;
  return d;
end $$;

-- 트리거 함수들
create function public.trg_attendance_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.attendance = 'attended' then
    perform public.add_xp(new.user_id, 'attend', new.id::text);
  elsif tg_op = 'UPDATE' and old.attendance = 'attended' then
    perform public.remove_xp(new.user_id, 'attend', new.id::text);
  end if;
  perform public.award_titles(new.user_id);
  perform public.eval_boards(new.user_id);
  return new;
end $$;

create function public.trg_review_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.add_xp(new.user_id, 'review', new.id::text);
  return new;
end $$;

create function public.trg_host_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.host_id is not null then perform public.add_xp(new.host_id, 'host', new.id::text); end if;
  return new;
end $$;

-- 체크인: 기본 XP, 7일 연속이 될 때마다 보너스 XP
create function public.trg_checkin_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d date := new.day; n integer := 0;
begin
  perform public.add_xp(new.user_id, 'checkin', new.day::text);
  while n < 400 and exists (select 1 from public.daily_checkins c where c.user_id = new.user_id and c.day = d) loop
    n := n + 1; d := d - 1;
  end loop;
  if n > 0 and n % 7 = 0 then perform public.add_xp(new.user_id, 'streak7', new.day::text); end if;
  return new;
end $$;

-- 크루는 최대 6명
create function public.trg_crew_size() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.crew_members m where m.crew_id = new.crew_id) >= 6 then
    raise exception 'crew_full' using errcode = 'P0001';
  end if;
  return new;
end $$;
