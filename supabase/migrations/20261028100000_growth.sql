-- 4단계 유입과 공유: 친구 초대 코드, 마감 임박 알림(관심 모임 + 남은 자리 2석 이하)

-- 알림 종류 확장(seats_low)
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reunion_match', 'manner_badge', 'trust_down', 'level_up', 'coupon', 'title', 'crew', 'seats_low'));

-- ① 내 초대 코드: 회원 가입 때 자동으로 생기고, 회원은 바꿀 수 없다(컬럼 권한에 없음)
alter table public.profiles add column if not exists invite_code text unique default upper(substr(md5(gen_random_uuid()::text), 1, 8));
update public.profiles set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 8)) where invite_code is null;
alter table public.profiles alter column invite_code set not null;

-- ② 초대 기록: 한 사람은 한 번만 초대받을 수 있다. 쿠폰은 서버(api/growth)가 둘 다에게 지급한다.
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);
create index if not exists invites_inviter on public.invites (inviter_id);
alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;
create policy "내가 초대한 기록만 조회" on public.invites for select to authenticated using (inviter_id = auth.uid());

-- 초대 보상 쿠폰 템플릿(관리자 화면에서 값·기간 조정 가능)
insert into public.coupon_templates (code, name, type, value, valid_days) values
  ('INVITE5000', '{"ko":"친구 초대 5천원 쿠폰","en":"Friend invite 5,000 KRW coupon","zh":"邀请好友5千韩元优惠券","ja":"友達招待 5千ウォンクーポン","es":"Cupón de invitación de 5.000 KRW"}', 'amount', 5000, 60)
on conflict (code) do nothing;

-- ③ 관심 모임(마감 임박 알림 받기)
create table if not exists public.trip_watch (
  user_id    uuid not null references auth.users (id) on delete cascade,
  trip_id    uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.trip_watch enable row level security;
revoke all on public.trip_watch from anon, authenticated;
grant select, insert, delete on public.trip_watch to authenticated;
create policy "내 관심 모임 조회" on public.trip_watch for select to authenticated using (user_id = auth.uid());
create policy "내 관심 모임 추가" on public.trip_watch for insert to authenticated with check (user_id = auth.uid());
create policy "내 관심 모임 삭제" on public.trip_watch for delete to authenticated using (user_id = auth.uid());
create policy "정지 회원 제외 관심 모임" on public.trip_watch as restrictive for insert to authenticated
  with check (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'suspended'));

-- 같은 모임·같은 남은 자리 수로는 알림을 한 번만 보낸다(서버·트리거 전용, 정책 없음)
create table if not exists public.trip_alerts (
  trip_id uuid not null references public.trips (id) on delete cascade,
  left_n  integer not null,
  sent_at timestamptz not null default now(),
  primary key (trip_id, left_n)
);
alter table public.trip_alerts enable row level security;
revoke all on public.trip_alerts from anon, authenticated;

-- 신청이 들어와 남은 자리가 1~2석이 되면 관심 모임 등록자 + 아직 결제 전인 신청자에게 알림
create or replace function public.notify_seats_low() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap integer; ttl text; used integer; left_n integer; fresh boolean;
begin
  select t.capacity, t.title into cap, ttl from public.trips t where t.id = new.trip_id and t.status = 'open' and not t.hidden;
  if cap is null then return new; end if;
  select count(*) into used from public.trip_applications a where a.trip_id = new.trip_id and a.status <> 'cancelled';
  left_n := cap - used;
  if left_n between 1 and 2 then
    fresh := null;
    insert into public.trip_alerts (trip_id, left_n) values (new.trip_id, left_n) on conflict do nothing returning true into fresh;
    if fresh then
      insert into public.notifications (user_id, kind, data)
      select x.uid, 'seats_low', jsonb_build_object('trip_id', new.trip_id, 'title', ttl, 'left', left_n)
      from (select w.user_id as uid from public.trip_watch w where w.trip_id = new.trip_id
            union select a.user_id from public.trip_applications a where a.trip_id = new.trip_id and a.status = 'applied') x
      where x.uid <> new.user_id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.notify_seats_low() from public, anon, authenticated;
drop trigger if exists on_application_seats on public.trip_applications;
create trigger on_application_seats after insert or update of status on public.trip_applications
  for each row execute function public.notify_seats_low();
