// GET /trip/<id>?ref=<초대코드>&lang=ko|en|zh|ja|es   (vercel.json이 /trip/:id를 이 함수로 보낸다)
// 로그인 없이 볼 수 있는 모임 상세 미리보기. 링크 공유용 OG 메타(제목·설명·이미지)를 서버에서 넣어 SNS·메신저 미리보기가 나온다.
// 공개된 모임(숨김 아님·승인됨)만 보여 주고, 연락처·신청자 정보는 담지 않는다. 신청은 로그인 후 여행 신청 페이지에서 한다.
const { env, db, withErrors } = require('./_lib');

const UUID = /^[0-9a-f-]{36}$/i;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const L = {
  ko: { title: (t) => `${t} | 함께닿`, open: '모집 중', upcoming: '오픈 예정', past: '다녀온 여행', left: (n) => `남은 자리 ${n}석`, seats: (n, c) => `${n}/${c}명 신청`, free: '무료', cta: '로그인하고 신청하기', ctaPast: '다른 여행 보러 가기', note: '로그인하면 바로 신청할 수 있어요. 처음이라면 가입 후 친구 초대 쿠폰도 받아 보세요.', home: '홈으로', missing: '찾을 수 없는 모임이에요', slogan: '혼자 떠나도, 마음은 닿는다', fallbackDesc: '낯선 사람들과 떠나며 친해지는 소셜링 투어' },
  en: { title: (t) => `${t} | Hamkkedat`, open: 'Open', upcoming: 'Coming soon', past: 'Past trip', left: (n) => `${n} seat${n === 1 ? '' : 's'} left`, seats: (n, c) => `${n}/${c} joined`, free: 'Free', cta: 'Log in to join', ctaPast: 'Browse other trips', note: 'Log in to apply right away. New here? Sign up and get a friend-invite coupon.', home: 'Home', missing: 'Trip not found', slogan: 'Travel solo, feel connected', fallbackDesc: 'Social trips where strangers become friends' },
  zh: { title: (t) => `${t} | 함께닿`, open: '招募中', upcoming: '即将开放', past: '往期行程', left: (n) => `仅剩 ${n} 个名额`, seats: (n, c) => `已报名 ${n}/${c}`, free: '免费', cta: '登录后报名', ctaPast: '查看其他行程', note: '登录后即可立即报名。新用户注册还可获得邀请好友优惠券。', home: '首页', missing: '找不到该行程', slogan: '一个人出发，心也相连', fallbackDesc: '和陌生人一起出发的社交旅行' },
  ja: { title: (t) => `${t} | 함께닿`, open: '募集中', upcoming: 'オープン予定', past: '終了した旅行', left: (n) => `残り${n}席`, seats: (n, c) => `${n}/${c}名申込`, free: '無料', cta: 'ログインして申し込む', ctaPast: '他の旅行を見る', note: 'ログインするとすぐ申し込めます。初めての方は友達招待クーポンもどうぞ。', home: 'ホーム', missing: '旅行が見つかりません', slogan: '一人で旅立っても、心はつながる', fallbackDesc: '知らない人と旅して仲良くなるソーシャル旅行' },
  es: { title: (t) => `${t} | 함께닿`, open: 'Abierto', upcoming: 'Próximamente', past: 'Viaje pasado', left: (n) => `Quedan ${n} plaza${n === 1 ? '' : 's'}`, seats: (n, c) => `${n}/${c} inscritos`, free: 'Gratis', cta: 'Inicia sesión para unirte', ctaPast: 'Ver otros viajes', note: 'Inicia sesión para inscribirte al instante. ¿Eres nuevo? Regístrate y recibe un cupón de invitación.', home: 'Inicio', missing: 'Viaje no encontrado', slogan: 'Viaja solo, siente la conexión', fallbackDesc: 'Viajes sociales donde los desconocidos se hacen amigos' }
};
const money = (n, lang) => new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : lang, { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
const day = (d, lang) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang, { month: 'short', day: 'numeric' }) : '');

function page({ lang, t, title, desc, canonical, image, body, status }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${status === 404 ? '<meta name="robots" content="noindex">' : ''}
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
</head>
<body data-page="trip-preview">
<header><div class="wrap bar"><a class="logo" href="/" aria-label="함께닿"><span class="dots-mini" aria-hidden="true"><i></i><i></i></span><span class="logo-name">함께닿</span></a></div></header>
<main><section><div class="wrap" style="max-width:720px">${body}</div></section></main>
<footer><div class="wrap"><p>© 함께닿 · ${esc(t.slogan)}</p></div></footer>
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
  const refQ = /^[A-Z0-9]{8}$/.test(ref) ? `?ref=${ref}` : '';
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
  if (UUID.test(id) && e.supabaseUrl && e.serviceKey) {
    const store = db(e);
    const r = await store.select(`trips?select=id,title,summary,location,start_date,end_date,price,capacity,status,cover_url&id=eq.${id}&hidden=eq.false&approval_status=eq.approved&limit=1`);
    trip = r.ok && r.data && r.data[0];
    if (trip) trip.n = await store.count(`trip_applications?select=id&trip_id=eq.${id}&status=neq.cancelled`);
  }
  if (!trip) {
    return send(404, page({ lang, t, title: t.missing + ' | 함께닿', desc: t.fallbackDesc, canonical: base + '/', image: '', status: 404, body: `<div class="empty"><h2>${esc(t.missing)}</h2><p><a class="btn" href="/trips.html${refQ}">${esc(t.ctaPast)}</a></p></div>` }), 'public, s-maxage=60');
  }

  const left = trip.capacity ? trip.capacity - trip.n : null;
  const low = trip.status === 'open' && left != null && left > 0 && left <= 2;
  const dates = trip.start_date ? (trip.end_date && trip.end_date !== trip.start_date ? `${day(trip.start_date, lang)} – ${day(trip.end_date, lang)}` : day(trip.start_date, lang)) : '';
  const meta = [trip.location, dates].filter(Boolean).join(' · ');
  const desc = trip.summary || [meta, trip.price > 0 ? money(trip.price, lang) : t.free].filter(Boolean).join(' · ') || t.fallbackDesc;
  const cover = /^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(trip.cover_url || '') ? `<img src="${esc(trip.cover_url)}" alt="" style="width:100%;border-radius:20px;margin-bottom:16px">` : '';
  const status = trip.status === 'open' ? t.open : trip.status === 'upcoming' ? t.upcoming : t.past;
  const body = `<article class="card" style="padding:0 0 22px;overflow:hidden">
${cover}<div style="padding:0 22px"><p><span class="badge st-${esc(trip.status)}" style="position:static;display:inline-block">${esc(status)}</span>${low ? ` <strong style="color:var(--primary)">${esc(t.left(left))}</strong>` : ''}</p>
<h1 style="font-size:1.8rem;margin:8px 0">${esc(trip.title)}</h1>
${meta ? `<p>${esc(meta)}</p>` : ''}
${trip.summary ? `<p>${esc(trip.summary)}</p>` : ''}
<p><strong>${esc(trip.price > 0 ? money(trip.price, lang) : t.free)}</strong>${trip.capacity ? ` · ${esc(t.seats(trip.n, trip.capacity))}` : ''}</p>
<p><a class="btn" href="/trips.html${refQ}">${esc(trip.status === 'past' ? t.ctaPast : t.cta)}</a></p>
<p class="note">${esc(t.note)}</p></div></article>`;
  return send(200, page({ lang, t, title: t.title(trip.title), desc, canonical: `${base}/trip/${trip.id}`, image: `${base}/api/og?type=trip&id=${trip.id}`, body }), 'public, s-maxage=300, stale-while-revalidate=3600');
}

module.exports = withErrors('trip-page', handler);
