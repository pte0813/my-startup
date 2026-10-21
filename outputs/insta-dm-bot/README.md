# 인스타 댓글 → 팔로우 확인 → 자동 DM 봇

게시글에 키워드 댓글을 달면 안내 DM(+버튼)을 보내고, 버튼을 누른 사람이 팔로우 중이면 상세 내용을 DM으로 보내는 웹훅 서버입니다. 의존성 없이 Node 20+ 만 있으면 됩니다.

## 1. 로컬에서 흐름만 먼저 확인 (Meta 설정 불필요)

```bash
cd outputs/insta-dm-bot
DRY_RUN=1 IG_USER_ID=111 node server.js
```

다른 터미널에서 가짜 이벤트를 보냅니다. 실제 발송 대신 콘솔에 요청 내용이 찍힙니다.

```bash
# 댓글 이벤트
curl -XPOST localhost:3000/webhook -d '{"entry":[{"changes":[{"field":"comments","value":{"id":"c1","text":"정보 주세요","from":{"id":"222"},"media":{"id":"m1"}}}]}]}'
# 버튼 클릭 이벤트 (팔로우 중인 경우를 보려면 DRY_FOLLOW=1 로 서버 실행)
curl -XPOST localhost:3000/webhook -d '{"entry":[{"messaging":[{"sender":{"id":"222"},"postback":{"payload":"FOLLOWED"}}]}]}'
```

> 서버 배포는 `DEPLOY.md`(Cloud Run) 참고

## 2. 실제 연동 순서

1. 인스타 계정을 프로페셔널(비즈니스/크리에이터) 계정으로 전환
2. [Meta 개발자 센터](https://developers.facebook.com)에서 앱 생성 → Instagram 제품 추가
   - 권한: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`
   - 내 계정을 앱의 테스터로 추가하면 개발 모드에서 앱 심사 없이 사용 가능
3. 액세스 토큰과 인스타 계정 ID를 발급받아 `.env.example`을 `.env`로 복사해 채우기
4. 서버를 외부에서 접근 가능한 HTTPS 주소로 노출 (개발 중에는 ngrok / cloudflared 터널, 배포는 Cloud Run, Railway 등)
5. 앱 설정의 웹훅에 `https://<주소>/webhook` 과 `VERIFY_TOKEN` 등록 후 `comments`, `messages` 필드 구독
6. `node --env-file=.env server.js` 로 실행하고, 테스트 계정으로 댓글을 달아 확인

## 3. 알아둘 제약

- 댓글 1개당 Private Reply는 1회, 댓글 작성 후 7일 이내만 가능
- 사용자가 DM에 응답한 뒤에는 24시간 이내에만 일반 DM 가능
- 팔로우 여부(`is_user_follow_business`)는 사용자가 DM과 상호작용한 뒤에만 조회됨 → 그래서 버튼 단계가 있음
- 발송 한도가 있으므로 게시글이 크게 터지면 큐 처리 필요
- API 버전(`API_VERSION`)과 필드명은 변경될 수 있으니 [공식 문서](https://developers.facebook.com/docs/instagram-platform)로 확인
- 중복 방지(`handledComments`)는 메모리에만 있어 서버 재시작 시 초기화됨 (운영 시 DB 필요)
- 이 코드는 Meta 실계정으로는 아직 검증하지 않았고, DRY_RUN 모의 이벤트로 흐름만 확인했음
