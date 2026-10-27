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
  - 서버 함수: `api/*.js` (`_lib.js` 공통·오류 보고, `_ai.js` AI 공통). 설명은 `api/README.md`
  - **관리자**: `/admin`(= `admin.html`, 독립 파일) + `api/admin.js`. 권한은 `profiles.role`(super_admin/operator/cs/user)을 서버가 매번 확인하고, 변경 작업은 `admin_logs`에 기록한다. 데이터는 service_role로 서버에서만 읽는다. 오류 모니터링은 `monitor.js` + `SENTRY_DSN`(`outputs/monitoring-guide.md`)
  - 배포 설정: `vercel.json`(빌드 `node write-config.js`로 환경변수에서 `config.js` 생성, 보안 헤더, 크론), `.vercelignore`
  - 랜딩(사전 신청): `outputs/landing/` (별도 Vercel 프로젝트 `hamkkedat-landing`)
- DB: `supabase/migrations/` (규칙은 `supabase/README.md`). 옛 SQL 메모는 `outputs/*.sql`(기록용)
- 테스트: 별도 테스트 프레임워크 없음. 가짜 Supabase 스텁 + Playwright(chromium, `/opt/pw-browsers/chromium`)로 화면을, 가짜 fetch로 서버 함수를 시험한다.

## 인증 방식
- Supabase Auth(이메일+비밀번호). 브라우저는 `config.js`의 anon 키로 `supabase-js`를 쓰고 세션은 localStorage에 있다(쿠키 아님).
- 서버 함수는 `Authorization: Bearer <access token>`을 `/auth/v1/user`로 확인(`_lib.js verifyUser`)한 뒤 service_role 키로 DB를 읽고 쓴다.
- 가입하면 트리거 `handle_new_user`가 `profiles` 행을 만든다. 관리자 권한은 `profiles.role`(user/cs/operator/super_admin)이다.

## DB 스키마 요약 (Supabase `test`, 서울)
- `signups`(사전 신청), `profiles`(이름·AI 프로필·동의·**role·status·trust_score·warning_count**, 이 컬럼들은 회원이 못 바꾸게 컬럼 권한으로 막음), `trips`, `trip_applications`, `trip_counts`(인원수 뷰), `payments`, `reviews`(+저장소 `review-photos`), `suggestions`, `inquiries`
- AI·재만남: `ai_usage`, `ai_icebreakers`, `reunion_picks`(서로 고르면 성사), `manner_tags`(매너 칭찬, 서버만 접근)
- 신뢰: `trust_score = 80 + 3×출석 − 20×노쇼 − 5×경고`(0~100)를 DB 함수 `recompute_trust`가 트리거(`on_attendance_changed`, `on_warning_changed`)로 매번 다시 계산한다. 배지는 `user_badges`(회원은 자기 것만 조회, 부여는 트리거 `award_badges`), 알림은 `notifications`(회원은 자기 것 조회·읽음 표시만, 생성은 서버/트리거)
- 운영: `admin_logs`(최고 관리자만 조회), `reports`(회원은 신고 등록·내 신고 조회, 운영진은 전체), `daily_active`(DAU 집계, 회원은 오늘 자기 행만 insert), `trips.hidden/approval_status`(숨김·승인, 방문자는 공개된 모임만 조회), `trip_applications.attendance`(출석/노쇼)
- 게이미피케이션: `profiles.xp`(회원이 못 바꿈), `xp_rules`(관리자가 조정), `xp_events`(user_id+kind+ref 유일 → 중복 적립 방지, 트리거가 출석·후기·호스팅·체크인에 적립), 레벨 공식 필요 XP = 50·L·(L−1)(`level_of`), `user_titles`(관심사 태그 모임 3회 출석 → 칭호), `coupon_templates`/`user_coupons`/`level_rewards`(할인 정률·정액, 우선 참여권), `stamp_boards`/`user_board_rewards`(지역·관심사 도장판 → 쿠폰), `question_bank`/`daily_questions`/`daily_checkins`(pg_cron `rotate-daily-question`이 매일 질문 교체, 연속 출석), `seasons`/`season_missions`/`crews`(최대 6명)/`crew_members`/`crew_mission_claims`. 회원은 자기 행·공개 설정만 조회하고 모든 쓰기는 서버(`api/gamify.js`)·트리거. 퀘스트 화면은 `quest.html`, 결제 쿠폰은 `pay-prepare`(서버가 금액 계산, 최소 100원)·`pay-return`(결제 확정 시 사용 처리).
- 유입·공유: `profiles.invite_code`(자동 생성·회원이 못 바꿈), `invites`(초대받은 사람당 1건, 보상은 서버 `api/growth.js invite.redeem`이 INVITE5000 쿠폰을 양쪽에 지급 — 가입 14일 이내·자기 코드 불가·초대자 월 10명 한도), `trip_watch`(관심 모임, 본인만), `trip_alerts`(같은 모임·남은 자리 수 알림 중복 방지), 트리거 `notify_seats_low`(신청이 들어와 남은 자리 1~2석이 되면 관심 등록자와 결제 전 신청자에게 `seats_low` 알림). 공유 이미지는 `api/og.js`(satori+resvg, 글꼴 `fonts/Jua-Regular.ttf`는 한글·영문만 지원), 비회원 모임 미리보기는 `/trip/<id>`(= `api/trip-page.js`, OG 메타 포함). 이 때문에 `outputs/homepage/package.json`(satori·@resvg/resvg-js)이 생겼다.
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
