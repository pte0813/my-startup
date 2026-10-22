# X 랜딩페이지

`index.html` 한 장과 문의하기 서버리스 함수(`api/contact.js`)로 이루어져 있다. 문의는 Resend로 이메일 발송된다.

## 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `RESEND_API_KEY` | 예 | Resend API 키. 서버에서만 읽고 페이지에는 넣지 않는다. |
| `CONTACT_TO_EMAIL` | 예 | 문의를 받을 이메일 |
| `CONTACT_FROM_EMAIL` | 아니오 | 발신 주소. 기본값 `onboarding@resend.dev` |

`onboarding@resend.dev`로 보내면 Resend 계정에 가입한 이메일 주소로만 발송할 수 있다. 다른 주소로 받으려면 Resend에서 도메인을 인증하고 `CONTACT_FROM_EMAIL`을 그 도메인 주소로 바꾼다.

## 로컬 테스트

```
cp ../../.env.example ../../.env     # 이미 .env가 있으면 건너뛴다
# .env에 RESEND_API_KEY, CONTACT_TO_EMAIL 값을 채운다
npm install
npm run dev                          # http://localhost:3000
```

브라우저에서 http://localhost:3000 을 열고 "문의하기" 폼을 보내 본다. `index.html`을 파일로 직접 열면 `/api/contact`가 없어서 전송되지 않는다.

## Vercel에 배포

1. 프로젝트의 Root Directory를 `outputs/landing`으로 지정한다.
2. Settings → Environment Variables에 위 세 변수를 넣는다(`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, 필요하면 `CONTACT_FROM_EMAIL`). Production에 넣는다.
3. 배포한다. 환경변수를 바꾼 뒤에는 다시 배포해야 적용된다.

CLI로 넣을 때는 `vercel env add RESEND_API_KEY production`처럼 이름마다 실행하고 값은 입력창에 붙여 넣는다.

## 문의 폼 동작

- 서버에서 이름(100자), 이메일(형식, 254자), 문의 내용(2000자)을 검증한다.
- 사람에게 보이지 않는 `website` 칸이 채워지면 봇으로 보고 보내지 않는다.
- 문의자의 이메일은 `reply_to`로 설정되어, 받은 메일에서 답장하면 문의자에게 간다.
