# 몽몽 웹앱 (Next.js)

동네 맛집 큐레이션 앱의 웹 프론트엔드입니다. 기획은 `../../docs/`, 규칙은 `../../CLAUDE.md`를 따릅니다.

## 실행
```bash
npm install            # 저장소 루트에서
npm run dev            # http://localhost:3000
```
`.env.local`에 Supabase 정보(`.env.example` 참고)가 없으면 `supabase/seed/places.json`의 시드 데이터로 읽기 전용으로 동작합니다.

## 확인
```bash
npm test               # 공유 로직·데이터 변환 단위 테스트
npm run typecheck && npm run lint
npm run build && npx next start -p 3100
BASE_URL=http://localhost:3100 node ../../scripts/e2e-smoke.mjs   # 브라우저로 핵심 여정 확인
```

## 구조
- `src/app` — 페이지(홈, 리스트, 검색, 가게 상세, 안내)
- `src/components` — 카드, 칩, 탭바 등
- `src/lib` — 데이터 읽기(`catalog.ts`), 화면용 데이터 조립(`views.ts`), DB 행 변환(`db-rows.ts`)

> 이 프로젝트의 Next.js 는 16 버전입니다. 기존 지식과 다른 점이 있으니 `AGENTS.md`의 안내대로 `node_modules/next/dist/docs/`를 먼저 읽습니다.
