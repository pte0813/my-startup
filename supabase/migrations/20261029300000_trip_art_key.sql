-- 여행지별 일러스트 세트 키(art/dest/<키>-1~3.svg). 실제 사진(photos)이 없을 때 대표·갤러리 이미지로 쓴다.
alter table public.trips add column if not exists art_key text check (art_key is null or art_key ~ '^[a-z0-9-]{2,30}$');
