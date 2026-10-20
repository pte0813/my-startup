# my-startup (몽몽)

## 프로젝트 개요
- 서비스: **몽몽** — 웨이팅 팁과 예약 요령까지 담은, 직접 다녀온 사람이 검증하는 동네 맛집 큐레이션 앱.
- 현재 단계: 웹앱 개발 중 (프로토타입은 `outputs/curation-map/index.html`, 기획은 `docs/`).
- 기획·결정 사항은 `docs/`가 기준이다. 코드와 문서가 어긋나면 먼저 문서를 고친다.

## 기술 스택 (결정됨)
- 웹: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4
- 백엔드: Supabase (Postgres, Auth, Storage). 접근 제어는 **DB의 RLS가 기준**이다.
- 공유 로직: `packages/shared` (타입, 검증, 통계 계산). 이후 React Native 앱과 공유한다.
- 모바일: React Native(Expo) — 웹 배포 후 `apps/mobile`로 추가한다.
- 배포: Vercel(웹) + Supabase. 지도 API는 보류(외부 지도 링크만 제공).

## 폴더 구조
```
docs/                    기획 문서 (개요, 역할, 기능, 화면, 데이터 모델, 로드맵)
apps/web/                Next.js 웹앱
packages/shared/         타입·순수 로직·검증 (테스트 포함)
supabase/migrations/     DB 스키마와 RLS
supabase/seed/           시드 원본(places.json)
supabase/seed.sql        places.json 에서 자동 생성 (직접 고치지 않는다)
supabase/tests/          RLS 검증 SQL
scripts/                 시드 생성, DB 검증 스크립트
outputs/                 프로토타입·산출물
```

## 명령
| 목적 | 명령 |
|------|------|
| 개발 서버 | `npm run dev` |
| 전체 테스트 | `npm test` |
| 타입 검사 | `npm run typecheck` |
| 린트 | `npm run lint` |
| 빌드 | `npm run build` |
| DB 스키마·RLS 검증 | `bash scripts/test-db.sh` (임시 Postgres 를 띄워 마이그레이션·시드·RLS 를 검사) |
| 시드 SQL 재생성 | `node scripts/build-seed-sql.mjs` |
| 브라우저 여정 확인 | `npm run build && npx next start -p 3100 -w apps/web` 후 `node scripts/e2e-smoke.mjs` |

## 코드 규칙
- TypeScript strict. `any`를 쓰지 않는다. 날짜 문자열은 `YYYY-MM-DD`.
- **Next.js 16은 기존 지식과 다르다.** 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서를 읽는다(`apps/web/AGENTS.md` 참고). Cache Components가 켜져 있어 요청 시점 데이터(`cookies`, `searchParams`, `new Date()`)는 `<Suspense>` 안에서 읽고, 공개 데이터는 `use cache`로 캐시한다.
- "오늘" 날짜는 한국 시간 기준(`Asia/Seoul`)으로 계산하고, 순수 함수에는 `today` 인자로 넘긴다.
- 검증 규칙(`validateReview`, `validatePlace`)은 `packages/shared`에만 둔다. 서버 액션은 저장 직전에 반드시 다시 검증하고 세션·역할도 서버에서 다시 확인한다. 화면에서 버튼을 숨기는 것은 보안이 아니다.
- DB 접근 규칙은 RLS로 강제한다. 새 테이블은 RLS와 권한(grant)을 같은 마이그레이션에 넣고 `supabase/tests/rls.sql`에 케이스를 추가한다.
- 비밀 값(서비스 롤 키 등)은 코드·문서·커밋에 넣지 않는다. `.env.local`에만 두고 `.env.example`에 이름만 적는다. 브라우저에 노출되는 값은 `NEXT_PUBLIC_` 접두사만 허용한다.
- 화면 문구는 한국어, 존댓말("~합니다/~하세요"). 오류 메시지는 무엇이 잘못됐고 어떻게 고치는지 쓴다.
- 신뢰 장치는 모든 화면에서 지킨다: 후기 없으면 "검증 전", 90일 초과 시 "검증 N일 전", 협찬 후기는 반드시 표기.
- 외부 서비스(리뷰·사진)의 내용을 가져와 저장하지 않는다. 링크로만 연결한다. 사진은 직접 올린 것만 쓴다.

## 알려진 제약
- 이 실행 환경에서는 Supabase·Vercel 접속이 막혀 있다. 쓰기 기능(로그인, 후기·가게 저장)은 접속이 열린 뒤에 실제로 시험한다.
- `next start`를 종료할 때 `pkill -f "next start"`를 쓰지 않는다(셸까지 종료된다). `fuser -k 3100/tcp`를 쓴다.
- Cache Components 때문에 Next가 이전에 본 화면을 숨겨서 보존한다. 브라우저 테스트에서는 `:visible`로 눈에 보이는 요소만 센다.

## 작업 방식
- 기능 하나씩 "구현 → 테스트 → 실행 확인 → 커밋"을 반복한다. 큰 기능은 계획을 먼저 정리한다.
- 테스트: 순수 로직은 Vitest(`packages/shared`), DB 규칙은 `scripts/test-db.sh`, 화면은 브라우저로 직접 띄워 확인한다.
- 커밋 메시지는 한국어로 "무엇을 왜" 한 줄 요약 + 필요하면 본문.
- 계정·도메인·심사가 필요한 일은 사람이 한다. 막히면 멈추고 질문한다(`docs/06-로드맵.md`의 "사람이 직접 해야 할 일" 참고).

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
- 날짜는 `YYYY-MM-DD`, 요청과 결과는 각각 한 줄로 짧게 쓴다.
- `log.md`가 없으면 위 헤더와 함께 새로 만든다.
