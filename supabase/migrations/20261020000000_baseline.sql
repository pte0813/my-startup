-- 기준선(baseline): 2026-10-22까지 Supabase `test` 프로젝트에 이미 적용된 스키마를 새 환경(로컬/스테이징)에서 재현하려고 모아 둔 파일이다.
-- 운영 DB에는 다시 실행하지 않는다(이미 적용됨). 이후 변경은 이 폴더에 새 마이그레이션 파일로만 추가한다.
-- 원본: outputs/signups.sql, profiles.sql, homepage-schema.sql, homepage-schema-ai.sql (이 파일들은 기록용으로만 남긴다)

-- ====== 랜딩 사전 신청 (signups.sql) ======
-- 랜딩페이지 사전 신청 표: 방문자는 신청(INSERT)만 가능, 목록 조회는 불가
create table public.signups (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 100),
  email      text not null check (char_length(email) between 3 and 254),
  created_at timestamptz not null default now()
);

-- 행 단위 보안(RLS) 켜기: 정책이 없는 동작은 모두 막힘
alter table public.signups enable row level security;

-- 방문자(anon)에게는 INSERT 권한만 남기고 나머지는 회수
revoke all on public.signups from anon, authenticated;
grant insert on public.signups to anon, authenticated;

-- 신청 넣기만 허용하는 정책 (SELECT 정책은 일부러 만들지 않음)
create policy "방문자는 신청만 넣을 수 있다"
  on public.signups
  for insert
  to anon, authenticated
  with check (true);

-- 같은 이메일 중복 신청 막기 (대소문자 구분 없이)
-- 이미 위의 표를 만든 경우에는 이 아래 한 줄만 따로 실행하면 된다.
create unique index signups_email_unique on public.signups (lower(email));


-- ====== 회원 프로필(+가입 트리거) (profiles.sql) ======
-- 회원 정보 표: 본인만 자기 정보를 읽고 고칠 수 있다.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "본인 정보만 조회" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "본인 정보만 생성" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "본인 정보만 수정" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 가입하면 자동으로 profiles 행을 만든다 (가입 때 입력한 이름 사용)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 100));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ====== 여행·신청·문의·제안·후기·결제 (homepage-schema.sql) ======
-- 홈페이지 2단계: 여행 목록·여행 신청·문의·상품 제안·후기
-- 입력·승인은 Supabase 대시보드(Table Editor)에서 직접 한다.

-- 1) 여행: 방문자는 읽기만 가능, 등록·수정은 대시보드에서
create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  summary    text not null default '',
  location   text not null default '',
  start_date date,
  end_date   date,
  price      integer not null default 0 check (price >= 0),  -- 원, 0이면 화면에 표시 안 함
  capacity   integer check (capacity > 0),                    -- 정원, 비우면 표시 안 함
  status     text not null default 'upcoming' check (status in ('open', 'upcoming', 'past')),  -- 진행 중(모집 중) / 오픈 예정 / 진행했던
  cover_url  text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.trips enable row level security;
revoke all on public.trips from anon, authenticated;
grant select on public.trips to anon, authenticated;
create policy "여행은 누구나 조회" on public.trips for select to anon, authenticated using (true);

-- 2) 여행 신청: 로그인한 회원이 모집 중인 여행에만, 본인 신청만 보기
create table public.trip_applications (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  status     text not null default 'applied' check (status in ('applied', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
alter table public.trip_applications enable row level security;
revoke all on public.trip_applications from anon, authenticated;
grant select on public.trip_applications to authenticated;
grant insert (trip_id, name) on public.trip_applications to authenticated;
create policy "본인 신청만 조회" on public.trip_applications for select to authenticated using (user_id = auth.uid());
create policy "모집 중인 여행에 본인으로 신청" on public.trip_applications for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'open'));

-- 여행별 신청 인원(개인 정보 없이 숫자만 공개하는 보기)
create view public.trip_counts with (security_invoker = false) as
  select a.trip_id, count(*)::int as n from public.trip_applications a where a.status <> 'cancelled' group by a.trip_id;
revoke all on public.trip_counts from public, anon, authenticated;
grant select on public.trip_counts to anon, authenticated;

-- 3) 문의: 방문자는 접수만, 조회 불가
create table public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  email      text not null check (char_length(email) between 3 and 254),
  message    text not null check (char_length(message) between 10 and 4000),
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
revoke all on public.inquiries from anon, authenticated;
grant insert (name, email, message) on public.inquiries to anon, authenticated;
create policy "누구나 문의 접수" on public.inquiries for insert to anon, authenticated with check (true);

-- 4) 상품(여행) 제안: 로그인 회원만, 본인 것만 보기
create table public.suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 100),
  body       text not null check (char_length(body) between 10 and 4000),
  created_at timestamptz not null default now()
);
alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon, authenticated;
grant select on public.suggestions to authenticated;
grant insert (title, body) on public.suggestions to authenticated;
create policy "본인 제안만 조회" on public.suggestions for select to authenticated using (user_id = auth.uid());
create policy "본인으로 제안" on public.suggestions for insert to authenticated with check (user_id = auth.uid());

-- 5) 후기: 로그인 회원이 작성, 승인(approved=true) 후에만 공개
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 100),
  rating      integer not null check (rating between 1 and 5),
  body        text not null check (char_length(body) between 10 and 3000),
  photo_urls  text[] not null default '{}' check (cardinality(photo_urls) <= 3),
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (trip_id, author_name, rating, body, photo_urls) on public.reviews to authenticated;  -- approved는 회원이 정할 수 없음
create policy "승인된 후기는 누구나, 내 후기는 본인이 조회" on public.reviews for select to anon, authenticated
  using (approved = true or user_id = auth.uid());
create policy "본인으로 후기 작성(승인 전)" on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and approved = false);

-- 6) 후기 사진 저장소: 누구나 보기, 로그인 회원은 자기 폴더에만 업로드(5MB, 이미지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "후기 사진은 본인 폴더에만 업로드" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- (선택) 정원이 찬 여행에 DB에서도 신청을 막고 싶을 때 SQL Editor에서 실행하세요.
-- 화면에서는 이미 '마감'으로 표시되지만, 이 규칙을 넣으면 동시에 신청해도 정원을 넘지 않습니다.
-- drop policy "모집 중인 여행에 본인으로 신청" on public.trip_applications;
-- create policy "모집 중이고 자리가 남은 여행에 본인으로 신청" on public.trip_applications for insert to authenticated
--   with check (
--     user_id = auth.uid()
--     and exists (
--       select 1 from public.trips t
--       where t.id = trip_id and t.status = 'open'
--         and (t.capacity is null or coalesce((select c.n from public.trip_counts c where c.trip_id = t.id), 0) < t.capacity)
--     )
--   );

-- 7) 결제(나이스페이먼츠): 결제 기록은 서버(service_role 키)만 만들고 바꾼다. 회원은 본인 결제만 조회 가능
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null unique,
  user_id        uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.trip_applications (id) on delete cascade,
  trip_id        uuid not null references public.trips (id),
  amount         integer not null check (amount > 0),
  status         text not null default 'ready' check (status in ('ready', 'paid', 'failed', 'cancelled')),
  tid            text,
  pay_method     text,
  receipt_url    text,
  fail_reason    text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create index payments_user_idx on public.payments (user_id);
create index payments_application_idx on public.payments (application_id);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "본인 결제만 조회" on public.payments for select to authenticated using (user_id = auth.uid());


-- ====== AI 기능·재만남·개인정보 개선 (homepage-schema-ai.sql) ======
-- AI 추천 기능용 DB 변경 (이미 test 프로젝트에 적용됨: ai_profile_fields_and_usage)
-- 선택지(관심사 등)는 outputs/homepage/ai-options.json과 같아야 한다.
alter table public.profiles
  add column if not exists mbti text check (mbti is null or mbti in ('ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ')),
  add column if not exists interests text[] not null default '{}' check (interests <@ array['cafe','food','photo','hiking','camping','sea','exhibition','music','reading','workout','movie','boardgame']::text[] and cardinality(interests) <= 12),
  add column if not exists travel_styles text[] not null default '{}' check (travel_styles <@ array['relaxed','active','foodie','culture','nature','spontaneous']::text[] and cardinality(travel_styles) <= 6),
  add column if not exists active_times text[] not null default '{}' check (active_times <@ array['weekday_day','weekday_eve','weekend_day','weekend_eve']::text[] and cardinality(active_times) <= 4),
  add column if not exists ai_consent boolean not null default false,
  add column if not exists ai_consent_at timestamptz;

-- AI 호출 기록: 서버(service_role)만 읽고 쓴다. 하루 사용 횟수 제한에 쓴다.
create table if not exists public.ai_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  feature    text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- 2단계 아이스브레이킹: 여행·언어별로 한 번 만든 결과를 저장해 모두가 같은 내용을 보게 한다 (서버만 읽고 쓴다)
create table if not exists public.ai_icebreakers (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  lang       text not null check (lang in ('ko','en','zh','ja','es')),
  stats_hash text not null,
  content    jsonb not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, lang)
);
alter table public.ai_icebreakers enable row level security;
revoke all on public.ai_icebreakers from anon, authenticated;

-- 3단계 재만남: 지난 여행 참가자끼리 "다시 만나고 싶은 사람" 선택 (서버 함수 /api/reunion만 읽고 쓴다)
create table if not exists public.reunion_picks (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, from_user, to_user),
  check (from_user <> to_user)
);
create index if not exists reunion_picks_to on public.reunion_picks (trip_id, to_user);
alter table public.reunion_picks enable row level security;
revoke all on public.reunion_picks from anon, authenticated;

-- 개인정보 보호 개선 (이미 test 프로젝트에 적용됨: privacy_hardening_payments_consent)
-- 결제 기록은 법정 보관 의무가 있어, 회원이 탈퇴해도 지우지 않고 회원 연결만 끊는다.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
-- 개인정보 수집·이용 동의 기록
alter table public.profiles
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_consent_version text;

