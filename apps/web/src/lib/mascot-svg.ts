/**
 * 몽몽 캐릭터(잎을 얹은 복숭아색 구름)의 SVG 원본. 화면의 로고와 앱 아이콘(scripts/build-icons.mjs)이 같은 그림을 쓴다.
 * `id`가 겹치지 않도록 그라데이션 이름을 `mongmong-body`로 고정한다.
 */
export const MASCOT_VIEWBOX = "0 0 64 64";

export const MASCOT_INNER = `<defs><linearGradient id="mongmong-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc2b3"/><stop offset="1" stop-color="#f0735d"/></linearGradient></defs>
<path d="M33 15c-1-6 2-10 8-11 1 6-2 10-8 11z" fill="#62c99c"/><path d="M33 16v5" stroke="#3f9f77" stroke-width="2" stroke-linecap="round"/>
<g fill="url(#mongmong-body)"><circle cx="21" cy="37" r="13"/><circle cx="34" cy="29" r="15"/><circle cx="46" cy="37" r="13"/><rect x="14" y="36" width="40" height="19" rx="9.5"/></g>
<ellipse cx="26.5" cy="39" rx="2.7" ry="3.5" fill="#3b1d17"/><ellipse cx="41.5" cy="39" rx="2.7" ry="3.5" fill="#3b1d17"/>
<circle cx="25.7" cy="37.7" r="1" fill="#fff"/><circle cx="40.7" cy="37.7" r="1" fill="#fff"/>
<ellipse cx="20.5" cy="45" rx="3.6" ry="2.2" fill="#ff8a80" opacity=".6"/><ellipse cx="47.5" cy="45" rx="3.6" ry="2.2" fill="#ff8a80" opacity=".6"/>
<path d="M30.2 43.6q1.9 2.6 3.8 0q1.9 2.6 3.8 0" fill="none" stroke="#3b1d17" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
