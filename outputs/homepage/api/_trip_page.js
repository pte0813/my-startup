// GET /trip/<id>?ref=<초대코드>&lang=ko|en|zh|ja|es   (vercel.json이 /trip/:id를 /api/og?type=page로 보내고, og.js가 이 파일을 호출한다.
// Vercel Hobby 플랜은 서버리스 함수가 12개까지라 별도 함수로 만들지 않았다.)
// 여행 상세 페이지(로그인 없이 볼 수 있음, 서버에서 만든 HTML이라 링크 미리보기(OG)·검색에도 잡힌다).
// 공개된 모임(숨김 아님·승인됨)만 보여 주고 연락처·신청자 정보는 담지 않는다. 참가자 분위기는 "AI 추천 동의"한 신청자 3명 이상일 때 관심사 개수만 보여 준다.
// 신청·결제는 로그인이 필요해 여행 신청 페이지(trips.html)의 해당 카드로 이어 준다.
const { env, db } = require('./_lib');
const opts = require('../ai-options.json');

const UUID = /^[0-9a-f-]{36}$/i;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LANGS = ['ko', 'en', 'zh', 'ja', 'es'];
const LANG_NAMES = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語', es: 'Español' };
const L = {
  ko: { similar: '이런 여행은 어때요?', close: '닫기', prev: '이전 사진', next: '다음 사진', title: (t) => `${t} | 함께닿`, open: '모집 중', upcoming: '오픈 예정', past: '다녀온 여행', sample: '예시 상품', sampleNote: '이 여행은 화면을 보여 드리기 위한 예시 상품이에요.', left: (n) => `남은 자리 ${n}석`, seats: (n, c) => `${n}/${c}명 신청`, free: '무료', cta: '신청하러 가기', ctaPast: '다른 여행 보러 가기',
    price: '참가비', dates: '일정', people: '인원', min: (n) => `최소 ${n}명이 모이면 출발해요`, noMin: '정원이 차면 마감돼요', fitTitle: '이런 분께 추천해요', itinTitle: '일정', itinNote: '일정은 느슨하게 두어 자유롭게 어울릴 시간이 있어요.', incTitle: '포함 내역', excTitle: '불포함 내역', meetTitle: '집합 장소·시간', hostTitle: '호스트', mateTitle: '함께하는 사람들', mateDesc: (n) => `지금까지 ${n}명이 신청했고, 이 분들이 좋아하는 것들이에요.`, mateUnit: '명', reviewTitle: '다녀온 분들의 후기',
    safeTitle: '안심하고 신청하세요', safe1: '여행 후기와 매너 배지로 신뢰가 쌓이는 시스템이에요.', safe2: '불편한 일은 신고하면 운영팀이 확인하고 경고·정지로 조치해요.', safe3: '취소·환불 규정은 확정되는 대로 이 페이지에 안내해요. 신청 전에 궁금한 점은 문의해 주세요.', contact: '문의하기',
    note: '신청은 로그인 후 여행 신청 페이지에서 할 수 있어요. 처음이라면 가입 후 친구 초대 쿠폰도 받아 보세요.', missing: '찾을 수 없는 모임이에요', slogan: '혼자 떠나도, 마음은 닿는다', fallbackDesc: '낯선 사람들과 떠나며 친해지는 소셜링 투어', back: '여행 목록' },
  en: { similar: 'You might also like', close: 'Close', prev: 'Previous photo', next: 'Next photo', title: (t) => `${t} | Hamkkedat`, open: 'Open', upcoming: 'Coming soon', past: 'Past trip', sample: 'Sample trip', sampleNote: 'This is a sample trip to show how pages will look.', left: (n) => `${n} seat${n === 1 ? '' : 's'} left`, seats: (n, c) => `${n}/${c} joined`, free: 'Free', cta: 'Go to sign up', ctaPast: 'Browse other trips',
    price: 'Price', dates: 'Dates', people: 'Group', min: (n) => `Departs once ${n} people join`, noMin: 'Closes when full', fitTitle: 'Great for you if', itinTitle: 'Itinerary', itinNote: 'The schedule is relaxed, with free time to hang out.', incTitle: 'Included', excTitle: 'Not included', meetTitle: 'Meeting place & time', hostTitle: 'Host', mateTitle: 'Who is joining', mateDesc: (n) => `${n} people have signed up so far. Here is what they like.`, mateUnit: '', reviewTitle: 'Reviews from past travelers',
    safeTitle: 'Join with peace of mind', safe1: 'Trust builds through trip reviews and manner badges.', safe2: 'Report anything uncomfortable; our team reviews it and can warn or suspend members.', safe3: 'Cancellation and refund terms will be posted here once finalized. Please ask us before applying if you have questions.', contact: 'Contact us',
    note: 'Log in on the trips page to apply. New here? Sign up and get a friend-invite coupon.', missing: 'Trip not found', slogan: 'Travel solo, feel connected', fallbackDesc: 'Social trips where strangers become friends', back: 'All trips' },
  zh: { similar: '你可能还喜欢', close: '关闭', prev: '上一张', next: '下一张', title: (t) => `${t} | 함께닿`, open: '招募中', upcoming: '即将开放', past: '往期行程', sample: '示例行程', sampleNote: '这是用于展示页面效果的示例行程。', left: (n) => `仅剩 ${n} 个名额`, seats: (n, c) => `已报名 ${n}/${c}`, free: '免费', cta: '前往报名', ctaPast: '查看其他行程',
    price: '费用', dates: '日期', people: '人数', min: (n) => `满 ${n} 人即出发`, noMin: '满员即截止', fitTitle: '适合这样的你', itinTitle: '行程', itinNote: '行程安排轻松，留有自由相处的时间。', incTitle: '费用包含', excTitle: '费用不含', meetTitle: '集合地点与时间', hostTitle: '领队', mateTitle: '一起出发的人', mateDesc: (n) => `目前已有 ${n} 人报名，这是他们的兴趣。`, mateUnit: '人', reviewTitle: '往期旅行者的评价',
    safeTitle: '安心报名', safe1: '通过旅行评价和礼仪徽章积累信任。', safe2: '遇到不适可举报，运营团队会核实并给予警告或停用处理。', safe3: '取消与退款规则确定后会在此页面公布。报名前如有疑问请联系我们。', contact: '联系我们',
    note: '请登录后在行程报名页面报名。新用户注册还可获得邀请好友优惠券。', missing: '找不到该行程', slogan: '一个人出发，心也相连', fallbackDesc: '和陌生人一起出发的社交旅行', back: '行程列表' },
  ja: { similar: 'こんな旅行はいかが？', close: '閉じる', prev: '前の写真', next: '次の写真', title: (t) => `${t} | 함께닿`, open: '募集中', upcoming: 'オープン予定', past: '終了した旅行', sample: 'サンプル旅行', sampleNote: 'この旅行は画面をご覧いただくためのサンプルです。', left: (n) => `残り${n}席`, seats: (n, c) => `${n}/${c}名申込`, free: '無料', cta: '申し込みへ', ctaPast: '他の旅行を見る',
    price: '参加費', dates: '日程', people: '人数', min: (n) => `${n}名集まれば出発します`, noMin: '定員になり次第締切', fitTitle: 'こんな方におすすめ', itinTitle: '日程', itinNote: 'ゆるい日程で、自由に過ごす時間があります。', incTitle: '含まれるもの', excTitle: '含まれないもの', meetTitle: '集合場所・時間', hostTitle: 'ホスト', mateTitle: '一緒に行く人たち', mateDesc: (n) => `これまでに${n}名が申し込み、好きなものはこちらです。`, mateUnit: '名', reviewTitle: '参加者のレビュー',
    safeTitle: '安心してお申し込みください', safe1: '旅行レビューとマナーバッジで信頼が積み上がります。', safe2: '不快なことは通報すると運営チームが確認し、警告や停止で対応します。', safe3: 'キャンセル・返金規定は確定次第このページでご案内します。お申し込み前にご不明点はお問い合わせください。', contact: 'お問い合わせ',
    note: 'お申し込みはログイン後、旅行申込ページから。初めての方は友達招待クーポンもどうぞ。', missing: '旅行が見つかりません', slogan: '一人で旅立っても、心はつながる', fallbackDesc: '知らない人と旅して仲良くなるソーシャル旅行', back: '旅行一覧' },
  es: { similar: 'También te puede gustar', close: 'Cerrar', prev: 'Foto anterior', next: 'Foto siguiente', title: (t) => `${t} | 함께닿`, open: 'Abierto', upcoming: 'Próximamente', past: 'Viaje pasado', sample: 'Viaje de ejemplo', sampleNote: 'Este es un viaje de ejemplo para mostrar cómo se verán las páginas.', left: (n) => `Quedan ${n} plaza${n === 1 ? '' : 's'}`, seats: (n, c) => `${n}/${c} inscritos`, free: 'Gratis', cta: 'Ir a inscribirme', ctaPast: 'Ver otros viajes',
    price: 'Precio', dates: 'Fechas', people: 'Grupo', min: (n) => `Sale cuando haya ${n} personas`, noMin: 'Se cierra al llenarse', fitTitle: 'Ideal si', itinTitle: 'Itinerario', itinNote: 'El plan es relajado, con tiempo libre para convivir.', incTitle: 'Incluye', excTitle: 'No incluye', meetTitle: 'Lugar y hora de encuentro', hostTitle: 'Anfitrión', mateTitle: 'Quiénes van', mateDesc: (n) => `${n} personas se han inscrito. Esto es lo que les gusta.`, mateUnit: '', reviewTitle: 'Reseñas de viajeros anteriores',
    safeTitle: 'Inscríbete con tranquilidad', safe1: 'La confianza se construye con reseñas e insignias de buenos modales.', safe2: 'Si algo te incomoda, repórtalo: el equipo lo revisa y puede advertir o suspender.', safe3: 'Las condiciones de cancelación y reembolso se publicarán aquí cuando se definan. Pregúntanos antes de inscribirte si tienes dudas.', contact: 'Contacto',
    note: 'Inicia sesión en la página de viajes para inscribirte. ¿Eres nuevo? Regístrate y recibe un cupón de invitación.', missing: 'Viaje no encontrado', slogan: 'Viaja solo, siente la conexión', fallbackDesc: 'Viajes sociales donde los desconocidos se hacen amigos', back: 'Todos los viajes' }
};
const money = (n, lang) => new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : lang, { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
const day = (d, lang) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang, { month: 'short', day: 'numeric' }) : '');
const pick = (o, lang) => (o && typeof o === 'object' ? o[lang] || o.ko : undefined);
const interestName = (k, lang) => { const o = (opts.interests || {})[k]; return o ? o[lang] || o.ko : k; };
const coverKind = (t) => {
  const text = `${t.location || ''} ${t.title || ''}`.toLowerCase();
  if (/바다|해변|섬|제주|부산|강릉|속초|양양|여수|발리|하와이|괌|세부|다낭|푸껫|beach|sea|island|bali|hawaii|jeju/.test(text)) return 'sea';
  if (/산|설악|한라|지리|등산|트레킹|캠핑|알프스|히말라야|mount|hike|trek|alps/.test(text)) return 'mountain';
  if (/서울|도쿄|오사카|교토|후쿠오카|파리|런던|뉴욕|방콕|홍콩|타이베이|상하이|싱가포르|도시|seoul|tokyo|osaka|kyoto|paris|london|bangkok|city/.test(text)) return 'city';
  const kinds = ['sky', 'sea', 'mountain', 'city'];
  let h = 0;
  for (const ch of String(t.id || t.title || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return kinds[h % kinds.length];
};
const STYLE = `
.td{max-width:760px;margin:0 auto;padding:0 16px 96px}
.td h1{font-size:1.9rem;margin:6px 0 4px;line-height:1.25}
.td h2{font-size:1.25rem;margin:28px 0 10px}
.td .lead{margin:6px 0 0;font-size:1.05rem}
.td .gal{display:grid;gap:8px;margin:16px 0}
.td .gal img{width:100%;border-radius:20px;display:block;object-fit:cover;aspect-ratio:16/10;background:#fff}
.td .gal .thumbs{display:flex;gap:8px;overflow-x:auto}
.td .gal .thumbs img{width:96px;aspect-ratio:1;border-radius:12px;flex:none}
.td .sample{background:var(--secondary);color:#fff;border-radius:14px;padding:10px 14px;margin:12px 0;font-size:.95rem}
.td .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.td .chip{border-radius:999px;padding:4px 14px;background:var(--secondary);color:#fff;font-size:.9rem}
.td .chip.coral{background:var(--primary)}
.td .chip.soft{background:rgba(31,58,95,.1);color:var(--secondary)}
.td .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0}
.td .fact{background:#fff;border-radius:16px;padding:12px 14px}
.td .fact small{display:block;opacity:.7}
.td .fact strong{font-size:1.1rem}
.td .tl{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.td .tl li{background:#fff;border-radius:16px;padding:12px 16px;border-left:6px solid var(--primary)}
.td .tl strong{display:block}
.td .two{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.td .box{background:#fff;border-radius:16px;padding:14px 16px}
.td .box ul{margin:6px 0 0;padding-left:20px}
.td .host{display:flex;gap:12px;align-items:flex-start;background:#fff;border-radius:16px;padding:14px 16px}
.td .host img{width:56px;height:56px;border-radius:50%;flex:none}
.td .rev{background:#fff;border-radius:16px;padding:12px 16px;margin:8px 0}
.td .note{opacity:.75;font-size:.92rem}
.td .safe{background:var(--accent);border-radius:16px;padding:14px 18px}
.td .safe li{margin:4px 0}
.langs{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;font-size:.85rem;padding:8px 16px}
.langs a{color:var(--secondary)}
.langs a[aria-current]{font-weight:700;text-decoration:none}
.sim{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.sim a{background:#fff;border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;display:block}
.sim img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}
.sim div{padding:10px 14px}
.sim strong{display:block;line-height:1.3}
.sim small{opacity:.75}
#lb{border:0;padding:0;background:#000;color:#fff;width:min(960px,96vw);max-height:92vh;border-radius:16px}
#lb::backdrop{background:rgba(0,0,0,.8)}
#lb img{width:100%;max-height:82vh;object-fit:contain;display:block}
#lb .ctl{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;gap:8px}
#lb button{background:#fff;color:var(--secondary);border:0;border-radius:999px;padding:8px 16px;font:inherit;cursor:pointer}
.bar{position:fixed;left:0;right:0;bottom:0;background:#fff;box-shadow:0 -6px 20px rgba(31,58,95,.15);padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;z-index:20}
.bar b{font-size:1.1rem}
.bar .btn{white-space:nowrap}
`;

function pageShell({ lang, t, title, desc, canonical, image, body, status, alt }) {
  const langs = LANGS.map((l) => (l === lang ? `<a aria-current="true" href="?lang=${l}">${LANG_NAMES[l]}</a>` : `<a href="?lang=${l}">${LANG_NAMES[l]}</a>`)).join('');
  const hrefLangs = alt ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(alt(l))}">`).join('\n') : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${status === 404 ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(canonical)}">
${hrefLangs}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:site_name" content="함께닿">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta name="twitter:title" content="${esc(title)}">
<link href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&family=Jua&family=Noto+Sans+KR:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brand.css">
<link rel="stylesheet" href="/common.css">
<style>${STYLE}</style>
</head>
<body data-page="trip-detail">
<header><div class="wrap bar-h" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px"><a class="logo" href="/" aria-label="함께닿"><span class="dots-mini" aria-hidden="true"><i></i><i></i></span><span class="logo-name">함께닿</span></a><a href="/trips.html" style="font-size:.95rem">${esc(t.back)}</a></div></header>
<nav class="langs" aria-label="language">${langs}</nav>
<main class="td">${body}</main>
</body>
</html>`;
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); return res.end(); }
  const e = env();
  const url = new URL(req.url, 'http://x');
  const lang = L[url.searchParams.get('lang')] ? url.searchParams.get('lang') : 'ko';
  const t = L[lang];
  const id = String(url.searchParams.get('id') || '');
  const ref = (url.searchParams.get('ref') || '').toUpperCase();
  const refQ = /^[A-Z0-9]{8}$/.test(ref) ? `&ref=${ref}` : '';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  const base = e.baseUrl || `${proto}://${host}`;
  const send = (status, html, cache) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    res.end(req.method === 'HEAD' ? undefined : html);
  };

  let trip = null;
  // 서버 키가 있으면 service_role로, 없으면(프리뷰 배포) 공개 키로 읽는다. 공개 키로는 신청자·프로필을 못 읽으므로 인원은 공개 뷰(trip_counts)를 쓰고 참가자 분위기는 건너뛴다.
  const full = !!(e.supabaseUrl && e.serviceKey);
  const store = full ? db(e) : e.supabaseUrl && e.anonKey ? db({ ...e, serviceKey: e.anonKey }) : null;
  if (UUID.test(id) && store) {
    const r = await store.select(`trips?select=*&id=eq.${id}&hidden=eq.false&approval_status=eq.approved&limit=1`);
    trip = r.ok && r.data && r.data[0];
  }
  if (!trip) {
    return send(404, pageShell({ lang, t, title: t.missing + ' | 함께닿', desc: t.fallbackDesc, canonical: base + '/', image: '', status: 404, body: `<div class="empty" style="padding:48px 0"><h2>${esc(t.missing)}</h2><p><a class="btn" href="/trips.html">${esc(t.ctaPast)}</a></p></div>` }), 'public, s-maxage=60');
  }

  // 신청 현황과 참가자 분위기(동의한 신청자 3명 이상일 때만 관심사 개수) + 이 여행의 승인된 후기
  const apps = full ? (await store.select(`trip_applications?select=user_id&trip_id=eq.${id}&status=neq.cancelled&limit=500`)).data || [] : [];
  const n = full ? apps.length : ((await store.select(`trip_counts?select=n&trip_id=eq.${id}&limit=1`)).data || [{}])[0].n || 0;
  let mates = [];
  if (full && n >= 3) {
    const ids = apps.map((a) => a.user_id).filter((x) => UUID.test(x));
    const ps = (await store.select(`profiles?select=interests&ai_consent=eq.true&id=in.(${ids.join(',')})&limit=500`)).data || [];
    if (ps.length >= 3) {
      const cnt = {};
      for (const p of ps) for (const k of (Array.isArray(p.interests) ? p.interests : [])) if (opts.interests[k]) cnt[k] = (cnt[k] || 0) + 1;
      mates = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }
  }
  const reviews = (await store.select(`reviews?select=rating,body,author_name&trip_id=eq.${id}&approved=eq.true&order=created_at.desc&limit=3`)).data || [];

  // 비슷한 여행: 같은 지역·같은 관심사 태그가 많은 순으로 최대 3개(없으면 모집 중인 다른 여행)
  const others = (await store.select(`trips?select=id,title,title_i18n,location,location_i18n,price,status,region,tags,photos,art_key,cover_url,is_sample&hidden=eq.false&approval_status=eq.approved&status=in.(open,upcoming)&id=neq.${id}&limit=30`)).data || [];
  const score = (o) => (o.region && o.region === trip.region && o.region !== 'other' ? 2 : 0) + (o.tags || []).filter((k) => (trip.tags || []).includes(k)).length + (o.status === 'open' ? 0.5 : 0);
  const similar = others.map((o) => ({ o, sc: score(o) })).sort((a, b) => b.sc - a.sc).slice(0, 3).map((x) => x.o);
  const title = pick(trip.title_i18n, lang) || trip.title;
  const summary = pick(trip.summary_i18n, lang) || trip.summary;
  const location = pick(trip.location_i18n, lang) || trip.location;
  const left = trip.capacity ? trip.capacity - n : null;
  const low = trip.status === 'open' && left != null && left > 0 && left <= 2;
  const dates = trip.start_date ? (trip.end_date && trip.end_date !== trip.start_date ? `${day(trip.start_date, lang)} – ${day(trip.end_date, lang)}` : day(trip.start_date, lang)) : '';
  const priceTxt = trip.price > 0 ? money(trip.price, lang) : t.free;
  const status = trip.status === 'open' ? t.open : trip.status === 'upcoming' ? t.upcoming : t.past;
  const desc = summary || [location, dates, priceTxt].filter(Boolean).join(' · ') || t.fallbackDesc;
  const supa = (u) => new RegExp(`^${e.supabaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/storage/v1/object/public/trip-photos/`).test(u || '');
  const real = (trip.photos || []).filter(supa).slice(0, 8);
  // 실제 사진이 있으면 그것을, 없으면 여행지별 일러스트 3장(art_key)을 갤러리로 쓴다
  const artSet = /^[a-z0-9-]{2,30}$/.test(trip.art_key || '') ? [1, 2, 3].map((i) => `/art/dest/${trip.art_key}-${i}.svg`) : [];
  const photos = real.length ? real : artSet;
  const heroImg = photos[0] || (/^https:\/\//i.test(trip.cover_url || '') && /\.supabase\.co\//.test(trip.cover_url) ? trip.cover_url : `/art/cover-${coverKind(trip)}.svg`);
  const gallery = `<div class="gal"><img src="${esc(heroImg)}" alt="${esc(title)}"${photos.length ? ` data-lb="${esc(photos[0])}"` : ''}>${photos.length > 1 ? `<div class="thumbs">${photos.slice(1).map((u) => `<img src="${esc(u)}" alt="" loading="lazy" data-lb="${esc(u)}">`).join('')}</div>` : ''}</div>`;
  // 사진을 누르면 크게 보는 뷰어(좌우 이동·ESC)
  const lightbox = photos.length ? `<dialog id="lb" aria-label="${esc(title)}"><img alt=""><div class="ctl"><button type="button" data-prev>${esc(t.prev)}</button><span class="n"></span><button type="button" data-next>${esc(t.next)}</button><button type="button" data-x>${esc(t.close)}</button></div></dialog>
<script>(function(){var imgs=[].slice.call(document.querySelectorAll('.gal img[data-lb]'));var d=document.getElementById('lb');if(!imgs.length||!d)return;var im=d.querySelector('img'),n=d.querySelector('.n'),i=0;function show(k){i=(k+imgs.length)%imgs.length;im.src=imgs[i].getAttribute('data-lb');n.textContent=(i+1)+' / '+imgs.length}function open(k){show(k);d.showModal()}imgs.forEach(function(el,k){el.tabIndex=0;el.style.cursor='zoom-in';el.addEventListener('click',function(){open(k)});el.addEventListener('keydown',function(e){if(e.key==='Enter')open(k)})});d.addEventListener('click',function(e){if(e.target.closest('[data-prev]'))show(i-1);else if(e.target.closest('[data-next]'))show(i+1);else if(e.target.closest('[data-x]')||!e.target.closest('img,.ctl'))d.close()});d.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')show(i-1);if(e.key==='ArrowRight')show(i+1)})})();</script>` : '';

  const itin = pick(trip.itinerary_i18n, lang) || [];
  const inc = pick(trip.includes_i18n, lang) || [];
  const exc = pick(trip.excludes_i18n, lang) || [];
  const meeting = pick(trip.meeting_i18n, lang);
  const hostBio = pick(trip.host_bio_i18n, lang);
  const fit = (trip.tags || []).filter((k) => opts.interests[k]).map((k) => `<span class="chip soft">${esc(interestName(k, lang))}</span>`).join('');
  const href = `/trips.html?trip=${trip.id}${refQ}#card-${trip.id}`;
  const ctaLabel = trip.status === 'past' ? t.ctaPast : t.cta;
  const ctaHref = trip.status === 'past' ? '/trips.html' : href;

  const body = `${gallery}
<p class="chips"><span class="chip coral">${esc(status)}</span>${low ? `<span class="chip">${esc(t.left(left))}</span>` : ''}</p>
${trip.is_sample ? `<p class="sample">${esc(t.sample)} · ${esc(t.sampleNote)}</p>` : ''}
<h1>${esc(title)}</h1>
${[location, dates].filter(Boolean).length ? `<p>${esc([location, dates].filter(Boolean).join(' · '))}</p>` : ''}
${summary ? `<p class="lead">${esc(summary)}</p>` : ''}
<div class="facts">
  <div class="fact"><small>${esc(t.price)}</small><strong>${esc(priceTxt)}</strong></div>
  ${dates ? `<div class="fact"><small>${esc(t.dates)}</small><strong>${esc(dates)}</strong></div>` : ''}
  <div class="fact"><small>${esc(t.people)}</small><strong>${esc(trip.capacity ? t.seats(n, trip.capacity) : String(n))}</strong><small>${esc(trip.min_participants ? t.min(trip.min_participants) : t.noMin)}</small></div>
</div>
${fit ? `<h2>${esc(t.fitTitle)}</h2><p class="chips">${fit}</p>` : ''}
${itin.length ? `<h2>${esc(t.itinTitle)}</h2><ul class="tl">${itin.map((x) => `<li><strong>${esc(x.title)}</strong>${x.desc ? esc(x.desc) : ''}</li>`).join('')}</ul><p class="note">${esc(t.itinNote)}</p>` : ''}
${inc.length || exc.length ? `<div class="two" style="margin-top:20px">${inc.length ? `<div class="box"><strong>${esc(t.incTitle)}</strong><ul>${inc.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${exc.length ? `<div class="box"><strong>${esc(t.excTitle)}</strong><ul>${exc.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div>` : ''}
${meeting ? `<h2>${esc(t.meetTitle)}</h2><div class="box">${esc(meeting)}</div>` : ''}
${trip.host_name || hostBio ? `<h2>${esc(t.hostTitle)}</h2><div class="host"><img src="/art/avatar-1.svg" alt=""><div><strong>${esc(trip.host_name || '')}</strong>${hostBio ? `<p style="margin:4px 0 0">${esc(hostBio)}</p>` : ''}</div></div>` : ''}
${mates.length ? `<h2>${esc(t.mateTitle)}</h2><p>${esc(t.mateDesc(n))}</p><p class="chips">${mates.map(([k, c]) => `<span class="chip soft">${esc(interestName(k, lang))} ${c}${esc(t.mateUnit)}</span>`).join('')}</p>` : ''}
${reviews.length ? `<h2>${esc(t.reviewTitle)}</h2>${reviews.map((r) => `<div class="rev"><b>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</b><p style="margin:4px 0">${esc(String(r.body).slice(0, 200))}</p><small class="note">${esc(Array.from(String(r.author_name || ''))[0] || '')}**</small></div>`).join('')}` : ''}
${similar.length ? `<h2>${esc(t.similar)}</h2><div class="sim">${similar.map((o) => {
  const ph = (o.photos || []).find(supa);
  const img = ph || (/^[a-z0-9-]{2,30}$/.test(o.art_key || '') ? `/art/dest/${o.art_key}-1.svg` : `/art/cover-${coverKind(o)}.svg`);
  return `<a href="/trip/${esc(o.id)}${lang === 'ko' ? '' : `?lang=${lang}`}"><img src="${esc(img)}" alt="" loading="lazy"><div><strong>${esc(pick(o.title_i18n, lang) || o.title)}</strong><small>${esc(pick(o.location_i18n, lang) || o.location || '')}${o.price > 0 ? ' · ' + esc(money(o.price, lang)) : ''}</small></div></a>`;
}).join('')}</div>` : ''}
<h2>${esc(t.safeTitle)}</h2>
<ul class="safe"><li>${esc(t.safe1)}</li><li>${esc(t.safe2)}</li><li>${esc(t.safe3)} <a href="/contact.html">${esc(t.contact)}</a></li></ul>
<p class="note" style="margin-top:16px">${esc(t.note)}</p>
<div class="bar"><div><b>${esc(priceTxt)}</b>${low ? `<br><small>${esc(t.left(left))}</small>` : ''}</div><a class="btn big" href="${esc(ctaHref)}">${esc(ctaLabel)}</a></div>${lightbox}`;
  return send(200, pageShell({ lang, t, title: t.title(title), desc, canonical: `${base}/trip/${trip.id}${lang === 'ko' ? '' : `?lang=${lang}`}`, image: `${base}/api/og?type=trip&id=${trip.id}${lang === 'ko' ? '' : '&lang=en'}`, body, alt: (l) => `${base}/trip/${trip.id}${l === 'ko' ? '' : `?lang=${l}`}` }), 'public, s-maxage=300, stale-while-revalidate=3600');
}

module.exports = { tripPage: handler };
