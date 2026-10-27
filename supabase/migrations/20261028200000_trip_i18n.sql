-- 여행 정보(이름·장소·설명)의 언어별 번역. 한국어 원문은 기존 컬럼에 두고, 번역은 {"en":..,"zh":..,"ja":..,"es":..} 객체로 둔다(없으면 한국어로 표시).
alter table public.trips
  add column if not exists title_i18n jsonb not null default '{}' check (jsonb_typeof(title_i18n) = 'object'),
  add column if not exists location_i18n jsonb not null default '{}' check (jsonb_typeof(location_i18n) = 'object'),
  add column if not exists summary_i18n jsonb not null default '{}' check (jsonb_typeof(summary_i18n) = 'object');

-- 마감 임박 알림에도 번역 제목을 실어 받는 사람의 언어로 보여 준다
create or replace function public.notify_seats_low() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap integer; ttl text; ttl_i jsonb; used integer; left_n integer; fresh boolean;
begin
  select t.capacity, t.title, t.title_i18n into cap, ttl, ttl_i from public.trips t where t.id = new.trip_id and t.status = 'open' and not t.hidden;
  if cap is null then return new; end if;
  select count(*) into used from public.trip_applications a where a.trip_id = new.trip_id and a.status <> 'cancelled';
  left_n := cap - used;
  if left_n between 1 and 2 then
    fresh := null;
    insert into public.trip_alerts (trip_id, left_n) values (new.trip_id, left_n) on conflict do nothing returning true into fresh;
    if fresh then
      insert into public.notifications (user_id, kind, data)
      select x.uid, 'seats_low', jsonb_build_object('trip_id', new.trip_id, 'title', ttl, 'title_i18n', ttl_i, 'left', left_n)
      from (select w.user_id as uid from public.trip_watch w where w.trip_id = new.trip_id
            union select a.user_id from public.trip_applications a where a.trip_id = new.trip_id and a.status = 'applied') x
      where x.uid <> new.user_id;
    end if;
  end if;
  return new;
end $$;
