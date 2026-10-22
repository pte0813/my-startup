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
