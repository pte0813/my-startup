-- 로컬 검증용: Supabase 가 제공하는 최소 요소(역할, auth, storage)를 흉내 낸다. 운영 DB 에는 적용하지 않는다.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
