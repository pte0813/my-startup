| 날짜 | 요청 | 결과 |
|------|------|------|
| 2026-10-20 | CLAUDE.md 작성 및 log.md 기록 규칙 추가 | CLAUDE.md(개요·언어·log 규칙)와 log.md 생성 |
| 2026-10-20 | 소개 웹페이지 outputs/intro.html 제작 (질문 3개 후 모바일 대응) | 하고 싶은 일·강점·관심 분야를 담은 한 페이지 작성, 미리보기 게시 |
| 2026-10-20 | 소개 페이지에 이름(박태은) 추가 | 제목과 헤드라인에 이름 반영, 미리보기 갱신 |
| 2026-10-20 | 이력서(.doc) 검토 및 보완 | 지원분야에 맞춰 재구성한 outputs/resume_revised.docx 작성, 확인 필요 항목은 노란 표시 |
| 2026-10-22 | 아이디어(소셜링 투어) 기록, 5개 질문 후 브리프 정리 | CLAUDE.md 아이디어 항목 갱신, outputs/idea-brief.md 작성 |
| 2026-10-22 | 서비스 이름 5안 중 선택 후 브랜드 제작 | 함께닿 선정, brand/brand.json(슬로건·컬러 3색)과 brand/logo.svg 작성 |
| 2026-10-22 | 로고 글씨체를 둥글둥글한 손글씨 느낌으로 변경 | 함께닿은 Jua, 슬로건은 Gaegu Bold로 교체(글자는 윤곽선 변환), brand.json에 글꼴 기록 |
| 2026-10-22 | Supabase signups 표 SQL 작성(방문자는 신청만 가능) | outputs/signups.sql 작성, 붙여 넣는 위치 안내 |
| 2026-10-22 | 사전신청 랜딩페이지(문제→해결→혜택→신청) 제작, 중복 이메일 차단·동의 문구 포함 | outputs/landing/index.html·build.py 작성, signups.sql에 중복 방지 추가 (Supabase 실연결은 샌드박스 제한으로 미확인) |
| 2026-10-22 | 랜딩페이지 Vercel 배포 | hamkkedat-landing 프로젝트로 배포(production), 헤더 로고를 인라인으로 변경, 공개 접근 최종 확인은 미완료 |
| 2026-10-22 | 신청 시 Resend 확인 메일 발송(테스트 발신 주소, 테스트는 내 메일) | outputs/landing/api/signup.js·dev.js 작성, 페이지는 /api/signup 호출로 변경, 모의 테스트 통과·테스트 메일 1통 발송, Vercel 환경변수 설정 후 재배포 필요 |
| 2026-10-22 | 회사 홈페이지 outputs/homepage 제작(소개·서비스·팀·FAQ·문의, 메뉴, 사전신청 버튼), 팀·FAQ·문의는 공백 | 메뉴·모바일 햄버거·버튼 링크(hamkkedat-landing.vercel.app) 구현, 소개·서비스는 idea-brief 내용, 배포는 미진행 |
