-- 접근 규칙(RLS) 검증. 각 케이스가 실패하면 예외로 멈춘다.
\set ON_ERROR_STOP on

-- 사용자 4명: 방문자(anon), 회원, 에디터 2명, 관리자
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor1@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'editor2@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'member@example.com');
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'editor' where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
end $$;

create function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return; -- 막혔으니 정상
  end;
  raise exception '허용되면 안 되는데 허용됨: %', label;
end $$;

create function pg_temp.expect_rows(sql text, expected int, label text) returns void language plpgsql as $$
declare n int;
begin
  execute 'with t as (' || sql || ') select count(*) from t' into n;
  if n <> expected then raise exception '% — 기대 %행, 실제 %행', label, expected, n; end if;
end $$;

-- 1. 방문자: 공개 데이터는 읽고, 아무것도 쓰지 못한다
select pg_temp.as_user(null);
select pg_temp.expect_rows('select 1 from public.places', 201, '방문자는 게시된 가게 201곳을 본다');
select pg_temp.expect_rows('select 1 from public.areas', 14, '방문자는 동네 14곳을 본다');
select pg_temp.expect_rows('select 1 from public.place_stats', 201, '방문자는 집계 뷰를 본다');
select pg_temp.expect_fail('select 1 from public.profiles', '방문자 프로필 조회');
select pg_temp.expect_fail($$select public.set_user_role('00000000-0000-0000-0000-0000000000b1','admin')$$, '방문자 역할 부여');
select pg_temp.expect_fail($$insert into public.places (area_slug,name,category,situations) values ('seongsu','방문자가추가','한식',array['혼밥'])$$, '방문자 가게 추가');
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,body) values (1,'00000000-0000-0000-0000-0000000000b1',5,current_date,'가짜 후기')$$, '방문자 후기 작성');
select pg_temp.expect_fail($$delete from public.places where id=1$$, '방문자 가게 삭제');
reset role;

-- 2. 회원: 후기·가게를 쓸 수 없고, 역할을 올릴 수 없다
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,body) values (1,'00000000-0000-0000-0000-0000000000b1',5,(now() at time zone 'Asia/Seoul')::date,'회원 후기')$$, '회원 후기 작성');
select pg_temp.expect_fail($$insert into public.places (area_slug,name,category,situations,created_by) values ('seongsu','회원가게','한식',array['혼밥'],'00000000-0000-0000-0000-0000000000b1')$$, '회원 가게 추가');
select pg_temp.expect_fail($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1'$$, '회원이 스스로 관리자 되기');
select pg_temp.expect_fail($$select public.set_user_role('00000000-0000-0000-0000-0000000000b1','editor')$$, '회원이 역할 부여');
select pg_temp.expect_rows('select 1 from public.profiles', 1, '회원은 본인 프로필만 본다');
update public.profiles set display_name = '새이름' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.saves (user_id, place_id) values ('00000000-0000-0000-0000-0000000000b1', 1);
select pg_temp.expect_fail($$insert into public.saves (user_id, place_id) values ('00000000-0000-0000-0000-0000000000e1', 2)$$, '남의 이름으로 찜');
select pg_temp.expect_rows('select 1 from public.saves', 1, '회원은 본인 찜만 본다');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id, name) values ('place-photos', 'x.jpg')$$, '회원 사진 업로드');
reset role;

-- 3. 에디터: 후기·가게를 쓰되 본인 것만 고친다
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into public.reviews (place_id, author_id, rating, visited_on, wait_minutes, body, sponsored)
  values (1, '00000000-0000-0000-0000-0000000000e1', 4, (now() at time zone 'Asia/Seoul')::date, 20, '국물이 진해요', false);
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,body) values (1,'00000000-0000-0000-0000-0000000000e2',5,(now() at time zone 'Asia/Seoul')::date,'남의 이름으로')$$, '다른 사람 이름으로 후기');
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,body) values (1,'00000000-0000-0000-0000-0000000000e1',6,(now() at time zone 'Asia/Seoul')::date,'별점 6')$$, '별점 범위');
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,body) values (1,'00000000-0000-0000-0000-0000000000e1',5,(now() at time zone 'Asia/Seoul')::date + 1,'미래 방문')$$, '미래 방문일');
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,body) values (1,'00000000-0000-0000-0000-0000000000e1',5,(now() at time zone 'Asia/Seoul')::date,'가')$$, '너무 짧은 후기');
select pg_temp.expect_fail($$insert into public.reviews (place_id,author_id,rating,visited_on,wait_minutes,body) values (1,'00000000-0000-0000-0000-0000000000e1',5,(now() at time zone 'Asia/Seoul')::date,601,'대기 범위 초과')$$, '대기 시간 범위');
insert into public.places (area_slug, name, category, situations, created_by)
  values ('seongsu', '에디터가게', '한식', array['혼밥'], '00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_fail($$insert into public.places (area_slug,name,category,situations,created_by) values ('seongsu','에디터가게','한식',array['혼밥'],'00000000-0000-0000-0000-0000000000e1')$$, '같은 동네 같은 이름');
select pg_temp.expect_fail($$insert into public.places (area_slug,name,category,situations,created_by) values ('seongsu','잘못된상황','한식',array['없는상황'],'00000000-0000-0000-0000-0000000000e1')$$, '허용되지 않은 상황 값');
update public.places set wait_tip = '평일 17시 입장' where name = '에디터가게';
select pg_temp.expect_rows($$delete from public.places where name='에디터가게' returning 1$$, 0, '에디터는 가게를 지우지 못한다(관리자 전용)');
insert into storage.objects (bucket_id, name) values ('place-photos', 'ok.jpg');
reset role;

-- 4. 다른 에디터는 남의 후기를 고치거나 지울 수 없다
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.expect_rows($$update public.reviews set body = '덮어쓰기' where body = '국물이 진해요' returning 1$$, 0, '남의 후기 수정');
select pg_temp.expect_rows($$delete from public.reviews returning 1$$, 0, '남의 후기 삭제');
reset role;

-- 5. 집계: 후기를 쓰면 평점·검증일이 생긴다
select pg_temp.as_user(null);
do $$ declare s record; begin
  select * into s from public.place_stats where place_id = 1;
  if s.review_count <> 1 or s.avg_rating <> 4 or s.last_visited_on is null then raise exception '집계가 틀림: %', s; end if;
  select * into s from public.place_stats where place_id = 2;
  if s.review_count <> 0 or s.avg_rating is not null then raise exception '후기 없는 가게 집계가 틀림: %', s; end if;
end $$;
select pg_temp.expect_rows('select 1 from public.author_names', 3, '작성자 이름 뷰는 에디터·관리자만 노출');
reset role;

-- 6. 관리자: 역할 부여, 후기·가게 삭제
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.set_user_role('00000000-0000-0000-0000-0000000000b1', 'editor');
select pg_temp.expect_rows($$delete from public.reviews returning 1$$, 1, '관리자는 모든 후기를 지운다');
delete from public.places where name = '에디터가게';
reset role;
do $$ begin
  if (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') <> 'editor' then raise exception '역할 부여 실패'; end if;
end $$;

\echo '모든 RLS 검증 통과'
