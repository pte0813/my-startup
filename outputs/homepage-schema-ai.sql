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
