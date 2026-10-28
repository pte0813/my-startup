-- 여행 사진 촬영자 표기(Unsplash 이용 약관). photos와 같은 순서의 [{n: 이름, u: 사용자명}] 배열.
alter table public.trips add column if not exists photo_credits jsonb not null default '[]'::jsonb;
