# Threads 자동화 봇

Threads 공식 API로 **게시글 예약 발행**과 **댓글 자동 응답**을 한다. 파이썬 3.9+ 표준 라이브러리만 쓴다.

## 준비
1. [Meta 개발자 앱](https://developers.facebook.com/)을 만들고 Threads API 사용 사례를 추가한다.
2. 권한 `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_read_replies`, `threads_manage_insights`로 장기 액세스 토큰을 발급한다.
3. `config.example.json` → `config.json`, `posts.example.json` → `posts.json`으로 복사해 수정한다.
4. `export THREADS_ACCESS_TOKEN=발급받은토큰` (토큰은 파일/커밋에 넣지 않는다).

## 실행
```
python bot.py post              # 모의 실행: 발행될 글만 출력
python bot.py reply --live      # 실제 댓글 응답
python bot.py run --live        # 발행 + 응답을 주기적으로 반복
python bot.py insights          # 좋아요/댓글/리포스트/인용 수
python test_bot.py              # 테스트
```
`--live` 없이는 아무것도 보내지 않는다.

## 응답 규칙 (`config.json`)
- `rules`는 위에서부터 처음 일치하는 규칙을 쓴다. `keywords`(부분 일치) 또는 `regex`, `replies`(여러 개면 무작위), `{username}` 치환 가능.
- `"default": true` 규칙은 어떤 규칙에도 안 맞을 때 쓴다. 없으면 답하지 않는다.
- 처음 실행할 땐 기존 댓글에 답하지 않고 기록만 한다(`reply_to_existing: true`면 답함).
- 같은 사람에겐 `user_cooldown_seconds` 안에 다시 답하지 않고, 내 계정 댓글은 무시한다. 처리 이력은 `state.json`.

## 한계
- Threads API는 **누가 리포스트/좋아요를 했는지 알려주지 않는다**(개수만 `insights`로 제공). 그래서 리포스트·좋아요에 개별 응답은 불가능하고, 댓글(대댓글 포함)에만 자동 응답한다.
- 일일 한도가 있다(게시 약 250건, 답글 약 1000건 / 24시간). 글자 수는 500자까지.
- 같은 문구를 반복하는 자동 응답은 스팸으로 제재될 수 있으니 문구를 여러 개 두고 쿨다운을 유지하는 것을 권장한다.
- 실제 Threads 계정으로는 아직 검증하지 않았다(모의 객체 테스트만 통과).
