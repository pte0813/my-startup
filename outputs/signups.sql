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
