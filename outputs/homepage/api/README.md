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
