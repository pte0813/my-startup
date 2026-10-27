-- 여행 상세 페이지용 정보: 사진, 최소 출발 인원, 호스트, 집합 장소, 일정, 포함/불포함(언어별 jsonb: {"ko": ..., "en": ..., "zh": ..., "ja": ..., "es": ...}),
-- 예시 상품 표시(is_sample). 사진은 공개 저장소 trip-photos(업로드는 관리자 서버 함수만, 조회는 누구나).
alter table public.trips
  add column if not exists photos text[] not null default '{}',
  add column if not exists min_participants integer check (min_participants is null or min_participants > 0),
  add column if not exists is_sample boolean not null default false,
  add column if not exists host_name text check (host_name is null or char_length(host_name) <= 50),
  add column if not exists meeting_i18n jsonb not null default '{}' check (jsonb_typeof(meeting_i18n) = 'object'),
  add column if not exists itinerary_i18n jsonb not null default '{}' check (jsonb_typeof(itinerary_i18n) = 'object'),
  add column if not exists includes_i18n jsonb not null default '{}' check (jsonb_typeof(includes_i18n) = 'object'),
  add column if not exists excludes_i18n jsonb not null default '{}' check (jsonb_typeof(excludes_i18n) = 'object'),
  add column if not exists host_bio_i18n jsonb not null default '{}' check (jsonb_typeof(host_bio_i18n) = 'object');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "여행 사진은 누구나 조회" on storage.objects for select to anon, authenticated using (bucket_id = 'trip-photos');
