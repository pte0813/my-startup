-- 몽몽 초기 스키마: 동네, 사용자, 가게, 후기, 찜 + 행 수준 보안(RLS) + 사진 저장소
-- 설계 문서: docs/05-데이터-모델.md

create type public.user_role as enum ('member', 'editor', 'admin');
create type public.place_status as enum ('published', 'draft', 'closed');

-- 동네
create table public.areas (
  slug       text primary key,
  name       text not null unique,
  sort_order int  not null
);

-- 사용자 프로필 (auth.users 와 1:1)
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 30),
  role         public.user_role not null default 'member',
  created_at   timestamptz not null default now()
);

-- 현재 사용자의 역할. RLS 정책이 profiles 를 다시 조회하며 재귀하지 않도록 security definer 로 둔다.
create function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('editor', 'admin'), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

-- 가입하면 프로필을 자동으로 만든다 (기본 역할: member)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 가게
create table public.places (
  id              bigint generated always as identity primary key,
  area_slug       text not null references public.areas (slug),
  name            text not null check (char_length(name) between 1 and 60),
  category        text not null check (char_length(category) between 1 and 20),
  situations      text[] not null
                    check (cardinality(situations) >= 1 and situations <@ array['데이트', '혼밥', '팀 회식']),
  summary         text not null default '' check (char_length(summary) <= 120),
  wait_tip        text check (char_length(wait_tip) <= 300),
  reservation_tip text check (char_length(reservation_tip) <= 300),
  address         text check (char_length(address) <= 120),
  photo_path      text,
  status          public.place_status not null default 'published',
  sort_order      int not null default 0,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (area_slug, name)
);
create index places_area_idx on public.places (area_slug, sort_order);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

-- 후기 (에디터만 작성)
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  place_id     bigint not null references public.places (id) on delete cascade,
  author_id    uuid not null references public.profiles (id),
  rating       smallint not null check (rating between 1 and 5),
  -- 한국 시간 기준 오늘까지만 허용
  visited_on   date not null check (visited_on <= (now() at time zone 'Asia/Seoul')::date),
  wait_minutes smallint check (wait_minutes between 0 and 600),
  body         text not null check (char_length(body) between 2 and 200),
  tip          text check (char_length(tip) <= 200),
  sponsored    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index reviews_place_idx on public.reviews (place_id, visited_on desc);

-- 찜
create table public.saves (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  place_id   bigint not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- 가게별 집계: 후기 수, 평균 평점, 마지막 검증일, 협찬 포함 여부
create view public.place_stats with (security_invoker = true) as
select p.id as place_id,
       count(r.id)::int                         as review_count,
       round(avg(r.rating)::numeric, 2)         as avg_rating,
       max(r.visited_on)                        as last_visited_on,
       coalesce(bool_or(r.sponsored), false)    as has_sponsored
from public.places p
left join public.reviews r on r.place_id = p.id
group by p.id;

-- 후기 작성자 표시용 공개 뷰 (에디터·관리자의 표시 이름만 노출)
create view public.author_names as
select id, display_name from public.profiles where role in ('editor', 'admin');

-- 관리자만 역할을 바꾼다
create function public.set_user_role(target uuid, new_role public.user_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 역할을 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target;
end $$;

-- ---------- 행 수준 보안 ----------
alter table public.areas    enable row level security;
alter table public.profiles enable row level security;
alter table public.places   enable row level security;
alter table public.reviews  enable row level security;
alter table public.saves    enable row level security;

-- areas
create policy areas_read  on public.areas for select using (true);
create policy areas_admin on public.areas for all using (public.is_admin()) with check (public.is_admin());

-- profiles: 본인만 읽고, 표시 이름만 고친다. 역할은 set_user_role 로만 바꾼다.
create policy profiles_read_own   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- places
create policy places_read   on public.places for select using (status = 'published' or public.is_editor());
create policy places_insert on public.places for insert with check (public.is_editor() and created_by = auth.uid());
create policy places_update on public.places for update using (public.is_editor()) with check (public.is_editor());
create policy places_delete on public.places for delete using (public.is_admin());

-- reviews
create policy reviews_read   on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert with check (public.is_editor() and author_id = auth.uid());
create policy reviews_update on public.reviews for update
  using (public.is_editor() and author_id = auth.uid()) with check (public.is_editor() and author_id = auth.uid());
create policy reviews_delete on public.reviews for delete
  using ((public.is_editor() and author_id = auth.uid()) or public.is_admin());

-- saves
create policy saves_own on public.saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- 테이블 권한 (RLS 와 함께 이중으로 막는다) ----------
revoke all on all tables in schema public from anon, authenticated;
grant select on public.areas, public.places, public.reviews, public.place_stats, public.author_names to anon, authenticated;
grant insert, update, delete on public.areas, public.places, public.reviews to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.saves to authenticated;
revoke execute on function public.set_user_role(uuid, public.user_role) from public;
grant  execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- ---------- 사진 저장소 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy place_photos_read   on storage.objects for select using (bucket_id = 'place-photos');
create policy place_photos_insert on storage.objects for insert with check (bucket_id = 'place-photos' and public.is_editor());
create policy place_photos_update on storage.objects for update using (bucket_id = 'place-photos' and public.is_editor());
create policy place_photos_delete on storage.objects for delete using (bucket_id = 'place-photos' and public.is_editor());
