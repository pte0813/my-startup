-- 회원 정보 표: 본인만 자기 정보를 읽고 고칠 수 있다.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "본인 정보만 조회" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "본인 정보만 생성" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "본인 정보만 수정" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 가입하면 자동으로 profiles 행을 만든다 (가입 때 입력한 이름 사용)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 100));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
