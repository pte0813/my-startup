-- 3단계 게이미피케이션 ① 기반 표: XP, 칭호, 쿠폰, 레벨 보상, 도장판, 데일리 질문 (이미 적용됨)
-- 알림 종류 확장: 기존 제약(notifications_kind_check)을 지우고 다시 만든다 (적용 때 `alter table ... drop constraint notifications_kind_check` 실행)
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reunion_match', 'manner_badge', 'trust_down', 'level_up', 'coupon', 'title', 'crew'));

-- 모임의 지역과 관심사 태그(도장판·칭호 계산용, 관리자가 입력)
alter table public.trips
  add column if not exists region text not null default 'other' check (region in ('domestic', 'asia', 'europe', 'americas', 'oceania', 'africa', 'other')),
  add column if not exists tags text[] not null default '{}' check (tags <@ array['cafe','food','photo','hiking','camping','sea','exhibition','music','reading','workout','movie','boardgame']::text[]);

-- XP 규칙(관리자가 조정)과 XP 기록(중복 적립 방지: 회원·종류·기준값이 같으면 한 번만)
create table public.xp_rules (
  kind   text primary key check (kind in ('attend', 'review', 'host', 'checkin', 'streak7')),
  xp     integer not null check (xp between 0 and 1000),
  active boolean not null default true,
  label  text not null
);
alter table public.xp_rules enable row level security;
revoke all on public.xp_rules from anon, authenticated;
grant select on public.xp_rules to anon, authenticated;
create policy "XP 규칙은 누구나 조회" on public.xp_rules for select to anon, authenticated using (true);

create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null references public.xp_rules (kind),
  ref        text not null,
  xp         integer not null check (xp >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index xp_events_user on public.xp_events (user_id, created_at desc);
create index xp_events_kind on public.xp_events (kind, created_at);
alter table public.xp_events enable row level security;
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;
create policy "내 XP 기록만 조회" on public.xp_events for select to authenticated using (user_id = auth.uid());

alter table public.profiles add column if not exists xp integer not null default 0 check (xp >= 0);

-- 관심사별 칭호
create table public.user_titles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  interest   text not null check (interest in ('cafe','food','photo','hiking','camping','sea','exhibition','music','reading','workout','movie','boardgame')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, interest)
);
alter table public.user_titles enable row level security;
revoke all on public.user_titles from anon, authenticated;
grant select on public.user_titles to authenticated;
create policy "내 칭호만 조회" on public.user_titles for select to authenticated using (user_id = auth.uid());

-- 쿠폰: 템플릿(관리자가 관리)과 회원이 가진 쿠폰
create table public.coupon_templates (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9_]{3,30}$'),
  name       jsonb not null,
  type       text not null check (type in ('percent', 'amount', 'priority')),
  value      integer not null default 0 check (value >= 0),
  valid_days integer not null default 90 check (valid_days between 1 and 730),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check ((type = 'percent' and value between 1 and 100) or (type = 'amount' and value > 0) or (type = 'priority'))
);
alter table public.coupon_templates enable row level security;
revoke all on public.coupon_templates from anon, authenticated;
grant select on public.coupon_templates to authenticated;
create policy "활성 쿠폰 템플릿 조회" on public.coupon_templates for select to authenticated using (active);

create table public.user_coupons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.coupon_templates (id),
  source      text not null check (source in ('stamp', 'crew', 'referral', 'level', 'manual')),
  source_ref  text not null default '',
  status      text not null default 'active' check (status in ('active', 'used', 'expired')),
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_ref    text
);
create unique index user_coupons_once on public.user_coupons (user_id, source, source_ref) where source <> 'manual';
create index user_coupons_user on public.user_coupons (user_id, status);
alter table public.user_coupons enable row level security;
revoke all on public.user_coupons from anon, authenticated;
grant select on public.user_coupons to authenticated;
create policy "내 쿠폰만 조회" on public.user_coupons for select to authenticated using (user_id = auth.uid());

-- 레벨 보상(레벨에 도달하면 쿠폰), 도장판(지역·관심사 도장을 목표 개수만큼 모으면 쿠폰)
create table public.level_rewards (
  level              integer primary key check (level between 2 and 50),
  coupon_template_id uuid not null references public.coupon_templates (id)
);
alter table public.level_rewards enable row level security;
revoke all on public.level_rewards from anon, authenticated;
grant select on public.level_rewards to authenticated;
create policy "레벨 보상 조회" on public.level_rewards for select to authenticated using (true);

create table public.stamp_boards (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[a-z0-9_]{3,30}$'),
  title              jsonb not null,
  kind               text not null check (kind in ('region', 'tag')),
  goal               integer not null check (goal between 1 and 20),
  coupon_template_id uuid references public.coupon_templates (id),
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
alter table public.stamp_boards enable row level security;
revoke all on public.stamp_boards from anon, authenticated;
grant select on public.stamp_boards to authenticated;
create policy "활성 도장판 조회" on public.stamp_boards for select to authenticated using (active);

create table public.user_board_rewards (
  user_id    uuid not null references auth.users (id) on delete cascade,
  board_id   uuid not null references public.stamp_boards (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, board_id)
);
alter table public.user_board_rewards enable row level security;
revoke all on public.user_board_rewards from anon, authenticated;
grant select on public.user_board_rewards to authenticated;
create policy "내 도장판 보상만 조회" on public.user_board_rewards for select to authenticated using (user_id = auth.uid());

-- 데일리 질문: 질문 은행(관리자), 오늘의 질문(크론이 매일 자정(KST)에 채움), 체크인(서버가 기록)
create table public.question_bank (
  id           uuid primary key default gen_random_uuid(),
  question     jsonb not null,
  a            jsonb not null,
  b            jsonb not null,
  active       boolean not null default true,
  last_used_on date,
  created_at   timestamptz not null default now()
);
alter table public.question_bank enable row level security;
revoke all on public.question_bank from anon, authenticated;

create table public.daily_questions (
  day      date primary key,
  bank_id  uuid references public.question_bank (id) on delete set null,
  question jsonb not null,
  a        jsonb not null,
  b        jsonb not null
);
alter table public.daily_questions enable row level security;
revoke all on public.daily_questions from anon, authenticated;
grant select on public.daily_questions to anon, authenticated;
create policy "오늘의 질문은 누구나 조회" on public.daily_questions for select to anon, authenticated using (true);

create table public.daily_checkins (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  choice     text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_checkins enable row level security;
revoke all on public.daily_checkins from anon, authenticated;
grant select on public.daily_checkins to authenticated;
create policy "내 체크인만 조회" on public.daily_checkins for select to authenticated using (user_id = auth.uid());
