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
