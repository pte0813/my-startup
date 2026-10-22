# my-startup

## 프로젝트 개요
- 서비스: **함께닿** — 밍글링투어처럼 2030을 타겟으로 한 소셜링 투어 (낯선 사람들과 함께 떠나며 친해지는 여행). 슬로건 "혼자 떠나도, 마음은 닿는다"
- 현재 단계: 홈페이지(웹) 운영 중 (GitHub + Vercel + Supabase). 기능을 단계별로 추가하는 중
- 기획 문서: `outputs/idea-brief.md`, 브랜드: `brand/brand.json`(이름·색·글꼴), `brand/logo.svg`

## 기술 구조
- **프레임워크 없음**: 정적 HTML/CSS/JS + Vercel 서버리스 함수(CommonJS). Next.js가 아니므로 Next 미들웨어는 쓰지 않는다. 권한 검사는 서버 함수(`api/`)와 DB의 RLS에서 한다.
- 웹: `outputs/homepage/`
  - `src/`(template.html, header.html, footer.html, pages/*.html, i18n.json) → `python3 outputs/homepage/build.py`가 `*.html`, `i18n.js`, `ai-options.js`, `brand.css`, `config.js`, `sitemap.xml`을 만든다. **`src/`를 고치고 build.py를 실행한다**(생성된 html을 직접 고치지 않는다). 예외: `account.html`, `admin.html`은 독립 파일이다.
  - 공용 스크립트: `common.js`(로그인·언어), `app.js`(여행·후기·AI·재만남 등 페이지 기능), `pay.js`(나이스페이먼츠), `common.css`, `i18n.json`(한·영·중·일·스페인어 5개 언어)
  - 서버 함수: `api/*.js` (`_lib.js` 공통, `_ai.js` AI 공통). 설명은 `api/README.md`
  - 배포 설정: `vercel.json`(빌드 `node write-config.js`로 환경변수에서 `config.js` 생성, 보안 헤더, 크론), `.vercelignore`
  - 랜딩(사전 신청): `outputs/landing/` (별도 Vercel 프로젝트 `hamkkedat-landing`)
- DB: `supabase/migrations/` (규칙은 `supabase/README.md`). 옛 SQL 메모는 `outputs/*.sql`(기록용)
- 테스트: 별도 테스트 프레임워크 없음. 가짜 Supabase 스텁 + Playwright(chromium, `/opt/pw-browsers/chromium`)로 화면을, 가짜 fetch로 서버 함수를 시험한다.

## 인증 방식
- Supabase Auth(이메일+비밀번호). 브라우저는 `config.js`의 anon 키로 `supabase-js`를 쓰고 세션은 localStorage에 있다(쿠키 아님).
- 서버 함수는 `Authorization: Bearer <access token>`을 `/auth/v1/user`로 확인(`_lib.js verifyUser`)한 뒤 service_role 키로 DB를 읽고 쓴다.
- 가입하면 트리거 `handle_new_user`가 `profiles` 행을 만든다. 관리자 권한은 `profiles.role`(user/cs/operator/super_admin)이다.

## DB 스키마 요약 (Supabase `test`, 서울)
- `signups`(사전 신청), `profiles`(이름·AI 프로필·동의·role), `trips`, `trip_applications`, `trip_counts`(인원수 뷰), `payments`, `reviews`(+저장소 `review-photos`), `suggestions`, `inquiries`
- AI: `ai_usage`, `ai_icebreakers`, `reunion_picks`
- 모든 표 RLS 켜짐. 서버만 다루는 표(`payments`, `ai_*`, `reunion_picks` 등)는 정책이 없고 브라우저 접근 권한도 없다.

## 개발 원칙
1. **DB 변경은 모두 `supabase/migrations`의 마이그레이션 파일로** 만들고, **모든 테이블에 RLS 정책**을 적용한다. 사용자가 바꾸면 안 되는 컬럼은 컬럼 단위 권한으로 막는다.
2. **service_role 키는 서버(`api/`)에서만** 쓴다. 브라우저 코드·config.js·로그에 넣지 않는다. 비밀 값은 채팅에 붙여넣지 않고 Vercel 환경변수에 직접 넣는다.
3. 작업은 **기능별 브랜치**(`feature/<번호>-<이름>`)에서 하고, 끝나면 **PR**을 올린다. PR의 기준(base)은 운영 브랜치 `claude/happy-franklin-9kfl94`이다(Vercel 운영 주소가 이 브랜치를 배포한다). 사용자가 요청하지 않은 PR은 만들지 않는다.
4. **프리뷰 확인**: PR 브랜치는 Vercel 프리뷰로 화면을 확인한다. 프리뷰에는 서비스 키·AI 키가 없어(운영에만 등록) 서버 기능은 동작하지 않는다 → 서버 기능은 병합 후 운영에서, 또는 가짜 서버 시험으로 확인한다. DB는 `test` 하나를 공유하므로 마이그레이션은 PR 전에 이미 적용될 수 있다 → **되돌릴 수 있는(추가형) 변경**을 우선한다.
5. 개인정보: 이름·이메일·연락처는 AI에 보내지 않고, 다른 회원에게 보이는 정보는 최소로 한다. (법률 검토는 보류 중. `outputs/privacy-security-review.md` 참고)
6. 배포: 푸시만으로 자동 배포되지 않는 경우가 있어 Vercel MCP `create_deployment`(gitSource)로 직접 배포한다. 운영 주소는 별칭이 이전 배포에 고정될 수 있으니 배포 뒤 `list_deployment_aliases`로 확인한다.

## 언어
- 대화, 문서, 커밋 메시지 모두 한국어로 작성한다.

## 작업 기록 규칙 (log.md)
- 작업이 끝날 때마다 `log.md`에 날짜·요청·결과를 한 줄씩 추가한다.
- 형식은 표이며, 새 행은 맨 아래에 붙인다.

  ```
  | 날짜 | 요청 | 결과 |
  |------|------|------|
  | 2026-10-20 | 요청 요약 | 결과 요약 |
  ```
- 날짜는 `YYYY-MM-DD`, 요청과 결과는 각각 한 줄로 짧게 쓴다. (기능 브랜치 작업도 같은 규칙으로 해당 브랜치의 log.md에 적는다.)
- `log.md`가 없으면 위 헤더와 함께 새로 만든다.
