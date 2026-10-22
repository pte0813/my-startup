# supabase/

DB 변경의 기준 위치. 운영 중인 프로젝트는 Supabase `test`(id `nahmlzlkkopzezmyevby`, 리전 서울)이다.

## 규칙
1. **모든 DB 변경은 `supabase/migrations/<YYYYMMDDHHMMSS>_<이름>.sql` 파일로 만든다.** 대시보드나 SQL 편집기에서 바로 바꾸지 않는다.
2. 파일 이름의 시각은 이전 파일보다 커야 한다. 이미 적용한 파일은 고치지 않고 새 파일을 추가한다.
3. 새 테이블은 같은 파일 안에서 곧바로 `enable row level security`를 켜고, 필요한 정책과 `revoke/grant`를 함께 쓴다. RLS가 켜진 채 정책이 없으면 서버(service_role)만 접근한다.
4. 권한은 최소로: `revoke all ... from anon, authenticated` 후 필요한 것만 `grant`. 사용자가 바꾸면 안 되는 컬럼(role, status, trust_score 등)은 컬럼 단위 `grant update (...)`에서 뺀다.
5. `service_role` 키는 `outputs/homepage/api/`의 서버 함수에서만 쓴다. 브라우저 코드·`config.js`에 넣지 않는다.
6. **`drop`·삭제 구문은 Supabase MCP가 사용자 확인을 기다리다 60초 뒤 시간 초과가 난다**(잠금 문제가 아님). 정책은 `alter policy`로 조건을 바꾸거나 제한 정책(`as restrictive`)을 추가하는 식으로 우회하고, 꼭 지워야 하면 대시보드 SQL 편집기에서 직접 실행한다.
7. 적용은 Supabase MCP의 `apply_migration`(이름은 파일 이름에서 시각을 뺀 것)으로 하고, 적용 뒤 `list_migrations`와 `get_advisors`(security)로 확인한다. 
8. 기준선 `20261020000000_baseline.sql`은 이미 적용된 스키마의 기록이다(재실행 금지).

## 운영 작업(마이그레이션이 아닌 데이터 변경)
- 최고 관리자 지정: `update public.profiles set role = 'super_admin' where id = (select id from auth.users where email = '<이메일>');`
  (회원은 자기 role을 바꿀 수 없다. 컬럼 권한으로 막혀 있다.) 이후 역할 변경은 /admin의 회원 관리에서 super_admin이 한다.
