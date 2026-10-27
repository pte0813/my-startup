-- 3단계 게이미피케이션 ② 시즌·크루·미션, 쿠폰을 결제에 연결 (이미 적용됨)
-- 시즌과 시즌 미션(활성 시즌은 하나만), 크루, 크루원, 미션 보상 수령 기록. 모두 서버(service_role)만 읽고 쓴다
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  starts_on  date not null,
  ends_on    date not null,
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index seasons_one_active on public.seasons ((true)) where active;
alter table public.seasons enable row level security;
revoke all on public.seasons from anon, authenticated;
grant select on public.seasons to anon, authenticated;
create policy "시즌은 누구나 조회" on public.seasons for select to anon, authenticated using (true);

create table public.season_missions (
  id                 uuid primary key default gen_random_uuid(),
  season_id          uuid not null references public.seasons (id) on delete cascade,
  kind               text not null check (kind in ('attend', 'review', 'checkin')),
  goal               integer not null check (goal between 1 and 1000),
  title              jsonb not null,
  coupon_template_id uuid references public.coupon_templates (id) on delete set null,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
alter table public.season_missions enable row level security;
revoke all on public.season_missions from anon, authenticated;
grant select on public.season_missions to anon, authenticated;
create policy "시즌 미션은 누구나 조회" on public.season_missions for select to anon, authenticated using (active);

create table public.crews (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 20),
  owner_id   uuid references auth.users (id) on delete set null,
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create unique index crews_name_per_season on public.crews (season_id, lower(name));
alter table public.crews enable row level security;
revoke all on public.crews from anon, authenticated;

create table public.crew_members (
  crew_id   uuid not null references public.crews (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id),
  unique (user_id, season_id)
);
alter table public.crew_members enable row level security;
revoke all on public.crew_members from anon, authenticated;

create table public.crew_mission_claims (
  user_id    uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null references public.season_missions (id) on delete cascade,
  crew_id    uuid references public.crews (id) on delete set null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);
alter table public.crew_mission_claims enable row level security;
revoke all on public.crew_mission_claims from anon, authenticated;

-- 쿠폰을 결제에 연결: 결제 기록에 사용한 쿠폰과 할인 금액을 남긴다
alter table public.payments
  add column if not exists coupon_id uuid references public.user_coupons (id) on delete set null,
  add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0),
  add column if not exists original_amount integer;
