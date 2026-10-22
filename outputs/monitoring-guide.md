# 에러 모니터링(Sentry) 연동 안내

코드는 이미 들어 있어요. **Sentry 계정에서 프로젝트를 만들고 DSN 하나를 Vercel 환경변수로 넣으면** 켜집니다. DSN이 없으면 아무 일도 하지 않아요.

## 1. Sentry 준비 (처음 한 번)
1. https://sentry.io 에서 계정을 만들고 **Create Project**를 누릅니다.
2. 플랫폼은 **Browser JavaScript**를 고르고 프로젝트 이름은 `hamkkedat-homepage`로 합니다. (서버 함수 오류도 같은 프로젝트로 받아요.)
3. 만들어진 프로젝트의 **Settings → Client Keys (DSN)** 에서 DSN을 복사합니다. 모양: `https://<공개키>@o<숫자>.ingest.sentry.io/<프로젝트번호>`
   - DSN은 공개 키라 브라우저에 들어가도 되지만, 채팅에는 붙여넣지 말고 아래 Vercel 화면에 직접 넣으세요.

## 2. Vercel에 넣기
1. Vercel → 프로젝트 `hamkkedat-homepage` → **Settings → Environment Variables**
2. Key `SENTRY_DSN`, Value 위에서 복사한 DSN, Environments **Production**(미리보기에서도 받고 싶으면 Preview도) → **Save**
3. **Deployments → Redeploy**(환경변수는 다시 배포해야 반영돼요).

## 3. 어떻게 동작하나
- **브라우저 오류**: `monitor.js`가 `config.js`의 `sentryDsn`을 보고 Sentry 스크립트를 불러와 자바스크립트 오류를 보냅니다. 사용자 정보·쿠키·요청 헤더는 지우고, 성능 추적·화면 녹화는 끄고, `sendDefaultPii: false`입니다.
- **서버 함수 오류**: `api/*.js`가 처리하지 못한 오류를 `_lib.js`의 `reportError`가 Sentry로 보냅니다(오류 종류·메시지·스택·함수 이름·환경만. 요청 본문·토큰·이메일은 보내지 않아요). 사용자에게는 내용 없이 `server_error`만 돌려줘요.
- 환경 구분: 운영 주소는 `production`, 그 밖의 vercel.app 주소는 `preview`로 표시돼요.
- 보안 설정(CSP)에 Sentry 주소(`browser.sentry-cdn.com`, `*.ingest.sentry.io`)가 이미 허용돼 있어요.

## 4. 확인하는 방법
- 배포 후 브라우저 개발자 도구 콘솔에 `Sentry.captureException(new Error("테스트"))`를 입력하면 몇 분 안에 Sentry **Issues**에 나타나요.
- 알림은 Sentry **Alerts → Create Alert**에서 "새 이슈가 생기면 이메일"을 만들어 두면 좋아요.

## 5. 주의
- Sentry는 미국 서비스라 처리방침의 "개인정보 처리 위탁·국외 이전" 표에 **Sentry(미국, 오류 정보)** 를 추가해야 해요(법률 검토 때 함께).
- 무료 요금제는 월 이벤트 수 한도가 있어요. 한도를 넘으면 새 오류가 버려질 수 있어요.
