# 서버 함수 (Vercel)

| 파일 | 하는 일 |
|------|---------|
| `inquiry.js` | 문의 저장 + 접수 확인 메일(Resend) |
| `pay-prepare.js` | 로그인 회원의 결제 주문 생성 (금액은 DB의 여행 가격만 사용) |
| `pay-return.js` | 나이스페이먼츠 결제창 결과 수신 → 주문·금액·서명 검증 → 승인 API → 결제 기록 |
| `_lib.js` | 위 함수들이 함께 쓰는 도구 |

## 환경변수 (Vercel 프로젝트 Settings → Environment Variables, 로컬은 저장소 루트 `.env`)

| 이름 | 용도 | 비밀 키? |
|------|------|:---:|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase 연결 | 아니오(공개용) |
| `SUPABASE_SERVICE_ROLE_KEY` | 결제 기록 저장(RLS 우회) | **예 — 브라우저·저장소에 절대 넣지 말 것** |
| `NICEPAY_CLIENT_ID` | 나이스페이먼츠 클라이언트 키(결제창용, 공개되는 값) | 아니오 |
| `NICEPAY_SECRET_KEY` | 나이스페이먼츠 시크릿 키(승인 API·서명 검증) | **예** |
| `NICEPAY_ENV` | `sandbox`(기본, 샌드박스 서버) 또는 `production` | 아니오 |
| `PUBLIC_BASE_URL` | 결제 결과를 돌려받을 사이트 주소(비우면 요청 주소 사용) | 아니오 |
| `RESEND_API_KEY`, `TEST_RECIPIENT`, `INQUIRY_NOTIFY_TO` | 문의 메일 | `RESEND_API_KEY`는 예 |

키가 하나라도 비어 있으면 결제 함수는 503(`payment_not_configured`)을 돌려주고, 화면은 "결제 기능을 준비 중이에요"를 보여줍니다.

## 결제 흐름
1. 회원이 여행에 신청 → `trip_applications.status = 'applied'`
2. "결제하기" → `/api/pay-prepare`가 `payments`에 `ready` 주문 생성 → 결제창(`AUTHNICE.requestPay`)
3. 결제창이 `/api/pay-return`으로 인증 결과를 POST → 검증 후 승인 API 호출
4. 성공: `payments.status='paid'`, `trip_applications.status='paid'` → `/account.html?pay=ok`
5. 승인 응답이 없으면 망취소, 승인 후 기록에 실패하면 자동 취소

## AI 기능 (api/ai-match.js, api/_ai.js)
- `POST /api/ai-match { trip_id, lang }` — 같은 여행 신청자 중 나와 잘 맞는 사람을 점수·공통점·이유와 함께 돌려준다.
- 점수와 공통점은 서버가 계산한다(AI 키가 없어도 동작). Claude는 "이유" 문장만 쓴다. 이름·연락처는 응답에도, AI 요청에도 넣지 않는다.
- 동의(`profiles.ai_consent`)한 회원의 선택지 값(MBTI·관심사·여행 스타일·활동 시간대)만 사용한다. 선택지는 `ai-options.json` 하나로 관리한다.
- 환경변수: `ANTHROPIC_API_KEY`(필수), `AI_MODEL`(기본 `claude-haiku-5-5`), `AI_DAILY_LIMIT`(회원당 하루 호출 수, 기본 10). `SUPABASE_*`는 결제와 같은 값을 쓴다.
- DB 변경은 `outputs/homepage-schema-ai.sql`.

### api/ai-icebreaker.js (2단계)
- `POST /api/ai-icebreaker { trip_id, lang }` — 신청자만 사용. 같은 여행 신청자 중 동의한 회원의 **공통 관심사 인원 수 통계**(2명 이상 겹치는 항목만)로 대화 주제 4개·밸런스 게임 3개·자기소개 템플릿·단톡방 첫인사를 만든다.
- 여행·언어별로 결과를 `ai_icebreakers`에 저장해 모두가 같은 내용을 본다(참가자 구성이 바뀌면 다시 만들고, 하루 사용 한도는 매칭과 같은 `AI_DAILY_LIMIT`).
- AI를 쓸 수 없으면(키 없음·한도·오류) 통계와 기본 자기소개 템플릿만 보여 준다.

### api/ai-review-card.js · api/reunion.js (3단계)
- `POST /api/ai-review-card { review_id, lang }` — 내가 쓴 후기를 인스타 공유용 카드 문구(제목·문구·해시태그)로 다듬는다. 카드 이미지(피드 4:5, 스토리 9:16)는 브라우저 canvas로 그린다. AI를 쓸 수 없으면 후기 본문으로 기본 문구를 만든다. 후기 본문은 "자료"로만 취급하게 해서 본문 속 지시문을 따르지 않는다.
- `POST /api/reunion { action: list|pick|unpick|suggest, trip_id, application_id? }` — 지난 여행(status=past)에서 다시 만나고 싶은 사람을 최대 5명까지 고른다. **서로 골랐을 때만** 성사로 보이고, 내가 누구를 골랐는지는 상대에게 보이지 않는다. 성사된 사람과는 `suggest`로 다음 모임(모집 중인 여행) 제안을 받는다. 연락처는 어디에도 나오지 않는다. `reunion_picks` 표는 브라우저에서 접근할 수 없다.

### 개인정보 보호 관련 (api/account.js · api/purge.js)
- `POST /api/account { action: 'export' | 'delete', confirm? }` — 내 데이터 내려받기(JSON)와 회원 탈퇴. 탈퇴하면 업로드한 후기 사진과 같은 이메일의 문의를 지우고 계정을 삭제해 프로필·신청·후기·제안·재만남 선택이 함께 삭제된다. 결제 기록은 법정 보관(5년)으로 회원 연결만 끊고 남긴다.
- `GET /api/purge` — 매주 일요일 크론. 문의 1년·AI 사용 기록 30일·아이스브레이킹 저장본 90일이 지난 데이터를 지운다. 환경변수 `CRON_SECRET`이 있어야 동작한다.
- 호출 한도: `ai-match` 하루 30회, `ai-icebreaker` 하루 20회(반복 조회로 다른 참가자의 성향을 추측하는 것을 막는다), `inquiry`는 같은 이메일 1시간 3건·전체 1분 30건(서버 전용 키가 있을 때).
- 응답은 모두 `Cache-Control: no-store`.

### api/admin.js (1단계 관리자)
- `POST /api/admin { action, ... }` — 운영자 전용. 매 요청마다 `profiles.role`을 서버가 확인한다(정지된 계정은 관리자여도 거절). 변경 작업은 모두 `admin_logs`에 남는다.
- 권한: `stats`(super_admin·operator), 회원 조회/경고(모든 운영진)/정지·해제(super_admin·operator)/역할 변경(super_admin), 모임 관리(super_admin·operator), 신고 처리(모든 운영진), 작업 로그(super_admin). 자기 자신과 super_admin 계정은 super_admin만 건드릴 수 있다.
- `POST /api/reunion`에 `action: 'report'` 추가: 같은 지난 여행 참가자를 신고(상대 계정 정보는 브라우저에 내려가지 않는다).
- 처리되지 않은 오류는 `withErrors`가 Sentry(`SENTRY_DSN`)로 보내고 사용자에게는 `server_error`만 돌려준다.
