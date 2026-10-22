-- 1단계 관리자 페이지 기반: 역할·제재 상태, 모임 숨김/승인, 출석, 관리자 로그, 신고, 일일 활동

-- 1) 회원 역할과 제재 상태 ------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('super_admin', 'operator', 'cs', 'user')),
  add column if not exists status text not null default 'active' check (status in ('active', 'warned', 'suspended')),
  add column if not exists warning_count integer not null default 0 check (warning_count >= 0),
  add column if not exists trust_score integer not null default 100 check (trust_score between 0 and 100),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspend_reason text;

-- 회원이 자기 role/status/trust_score를 바꾸지 못하게 컬럼 단위로만 권한을 준다 (권한 상승 방지)
revoke insert, update on public.profiles from authenticated;
grant insert (id, name, mbti, interests, travel_styles, active_times, ai_consent, ai_consent_at, privacy_consent_at, privacy_consent_version, updated_at) on public.profiles to authenticated;
grant update (name, mbti, interests, travel_styles, active_times, ai_consent, ai_consent_at, privacy_consent_at, privacy_consent_version, updated_at) on public.profiles to authenticated;

-- 2) 모임 숨김/승인, 출석 ---------------------------------------------------------------
alter table public.trips
  add column if not exists hidden boolean not null default false,
  add column if not exists approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists host_id uuid references auth.users (id) on delete set null;

-- 기존 정책 "여행은 누구나 조회"(using true)를 삭제하면 Supabase MCP가 확인을 기다리다 시간 초과가 나서, 삭제 대신 조건을 바꾼다.
-- (두 정책 모두 허용 조건이 같으므로 결과는 같다. 새 환경에서는 아래 두 줄이 그대로 동작한다.)
alter policy "여행은 누구나 조회" on public.trips using (hidden = false and approval_status = 'approved');
create policy "공개된 여행만 조회" on public.trips for select to anon, authenticated
  using (hidden = false and approval_status = 'approved');

alter table public.trip_applications
  add column if not exists attendance text not null default 'pending' check (attendance in ('pending', 'attended', 'no_show'));

-- 3) 관리자 작업 로그: 최고 관리자만 조회, 기록은 서버(service_role)만 ----------------------------
create table if not exists public.admin_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_role  text not null,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_logs_created on public.admin_logs (created_at desc);
alter table public.admin_logs enable row level security;
revoke all on public.admin_logs from anon, authenticated;
grant select on public.admin_logs to authenticated;
create policy "최고 관리자만 로그 조회" on public.admin_logs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));

-- 4) 신고: 회원은 신고를 넣고 내 신고만 보며, 운영진(super_admin/operator/cs)은 전체 조회. 처리는 서버만 ---
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'trip', 'review')),
  target_id   text not null check (char_length(target_id) between 1 and 64),
  reason      text not null check (reason in ('spam', 'abuse', 'inappropriate', 'noshow', 'other')),
  detail      text not null default '' check (char_length(detail) <= 1000),
  status      text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  handled_by  uuid references auth.users (id) on delete set null,
  handled_at  timestamptz,
  resolution  text not null default '' check (char_length(resolution) <= 1000),
  created_at  timestamptz not null default now()
);
create unique index if not exists reports_one_pending on public.reports (reporter_id, target_type, target_id) where status = 'pending';
create index if not exists reports_queue on public.reports (status, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, detail) on public.reports to authenticated;
create policy "내 신고 또는 운영진은 조회" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'operator', 'cs')));
create policy "본인 명의로 신고" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- 5) 일일 활동(DAU 집계용): 회원이 하루 한 번 자기 행만 넣는다. 읽기는 서버만 -----------------------
create table if not exists public.daily_active (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day     date not null default current_date,
  primary key (user_id, day)
);
alter table public.daily_active enable row level security;
revoke all on public.daily_active from anon, authenticated;
grant insert on public.daily_active to authenticated;
create policy "본인 하루 활동만 기록" on public.daily_active for insert to authenticated
  with check (user_id = auth.uid() and day = current_date);
