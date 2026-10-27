// GET /api/og?type=page&id=<uuid>   → 비회원 모임 미리보기 HTML(/trip/<id>가 여기로 온다, _trip_page.js)
// GET /api/og?type=trip|review&id=<uuid>&size=og|story      (공개: 링크 미리보기·공유 이미지)
// GET /api/og?type=me-title|me-report&size=og|story&lang=ko|en  (Authorization: Bearer <access token>: 내 칭호·성향 카드)
// Vercel OG와 같은 엔진(satori → SVG, resvg → PNG)으로 1200x630(og) 또는 1080x1920(인스타 스토리) PNG를 만든다.
// 공개 종류는 "공개된 모임"과 "승인된 후기"만 읽고, 개인 카드는 본인 토큰이 있어야 하며 이름·이메일·연락처는 담지 않는다.
// 글꼴(Jua)은 한글·영문·기본 기호만 지원한다(가운뎃점·특수 별·원화 기호 등은 없어 ASCII로 쓴다). 그래서 카드 문구는 ko/en만 만든다(그 외 언어는 en).
const fs = require('fs');
const path = require('path');
const { env, json, db, verifyUser, withErrors } = require('./_lib');
const { tripPage } = require('./_trip_page');

const NAVY = '#1F3A5F', CORAL = '#FF6B5B', CREAM = '#FFF1D6';
const UUID = /^[0-9a-f-]{36}$/i;
const SIZES = { og: [1200, 630], story: [1080, 1920] };
let fontData = null;
const font = () => fontData || (fontData = fs.readFileSync(path.join(__dirname, '..', 'fonts', 'Jua-Regular.ttf')));

const T = {
  ko: { brand: '함께닿', slogan: '혼자 떠나도, 마음은 닿는다', open: '모집 중', upcoming: '오픈 예정', past: '다녀온 여행', left: (n) => `남은 자리 ${n}석`, level: (n) => `Lv.${n}`, titles: '나의 칭호', title: (i) => `${i} 탐험가`, report: '나의 여행 성향', none: '아직 칭호가 없어요', mbti: 'MBTI', styles: '여행 스타일', interests: '관심사', free: '무료' },
  en: { brand: 'Hamkkedat', slogan: 'Travel solo, feel connected', open: 'Open', upcoming: 'Coming soon', past: 'Past trip', left: (n) => `${n} seat${n === 1 ? '' : 's'} left`, level: (n) => `Lv.${n}`, titles: 'My titles', title: (i) => `${i} Explorer`, report: 'My travel style', none: 'No titles yet', mbti: 'MBTI', styles: 'Travel style', interests: 'Interests', free: 'Free' }
};
const cut = (s, n) => { s = String(s || '').replace(/[^\u0020-\u007E\u3131-\u318E\uAC00-\uD7A3\u00C0-\u017F]/g, ' ').replace(/\s+/g, ' ').trim(); // 글꼴에 없는 글자는 빈칸으로
   return s.length > n ? s.slice(0, n - 1) + '...' : s; };
const won = (n, lang) => (lang === 'ko' ? `${Number(n).toLocaleString('en-US')}원` : `KRW ${Number(n).toLocaleString('en-US')}`);

// satori용 요소 도우미: 모든 상자는 flex
const h = (style, ...kids) => ({ type: 'div', props: { style: { display: 'flex', flexDirection: 'column', ...style }, children: kids.length === 1 ? kids[0] : kids } });
const row = (style, ...kids) => h({ flexDirection: 'row', ...style }, ...kids);
const pill = (text, bg, fg, size) => h({ background: bg, color: fg, fontSize: size, padding: `${Math.round(size * 0.25)}px ${Math.round(size * 0.7)}px`, borderRadius: 999 }, text);

function frame(size, lang, ...content) {
  const story = size === 'story', t = T[lang];
  const pad = story ? 90 : 64;
  return h({ width: '100%', height: '100%', background: CREAM, color: NAVY, padding: pad, justifyContent: 'space-between', fontFamily: 'Jua' },
    row({ alignItems: 'center', gap: 14 },
      row({ gap: 0 }, h({ width: story ? 44 : 36, height: story ? 44 : 36, borderRadius: 999, background: NAVY }), h({ width: story ? 44 : 36, height: story ? 44 : 36, borderRadius: 999, background: CORAL, marginLeft: -12 })),
      h({ fontSize: story ? 44 : 34 }, t.brand)),
    h({ gap: story ? 40 : 22, flexGrow: 1, justifyContent: 'center' }, ...content),
    h({ fontSize: story ? 38 : 28, color: CORAL }, t.slogan));
}

async function loadTrip(store, id, lang) {
  const r = await store.select(`trips?select=id,title,location,title_i18n,location_i18n,start_date,end_date,price,capacity,status&id=eq.${id}&hidden=eq.false&approval_status=eq.approved&limit=1`);
  const t = r.ok && r.data && r.data[0];
  if (!t) return null;
  for (const f of ['title', 'location']) { const tr = (t[f + '_i18n'] || {})[lang]; if (tr) t[f] = tr; } // 카드 언어(ko/en)의 번역이 있으면 쓴다
  t.n = await store.count(`trip_applications?select=id&trip_id=eq.${id}&status=neq.cancelled`);
  return t;
}

const fmtDates = (a, b) => (a ? (b && b !== a ? `${a.slice(5).replace('-', '.')}~${b.slice(5).replace('-', '.')}` : a.slice(5).replace('-', '.')) : '');

async function build(req, e, store) {
  const q = new URL(req.url, 'http://x').searchParams;
  const type = q.get('type'), size = SIZES[q.get('size')] ? q.get('size') : 'og';
  const lang = q.get('lang') === 'en' || !['ko'].includes(q.get('lang') || 'ko') ? 'en' : 'ko';
  const t = T[lang], story = size === 'story';
  const big = story ? 96 : 68, mid = story ? 52 : 36, small = story ? 40 : 28;

  if (type === 'trip') {
    const id = q.get('id') || '';
    const trip = UUID.test(id) && await loadTrip(store, id, lang);
    if (!trip) return { status: 404 };
    const left = trip.capacity ? trip.capacity - trip.n : null;
    const low = left != null && left > 0 && left <= 2 && trip.status === 'open';
    const status = trip.status === 'open' ? t.open : trip.status === 'upcoming' ? t.upcoming : t.past;
    return { size, lang, pub: true, el: frame(size, lang,
      row({ gap: 12 }, ...[pill(status, CORAL, '#fff', small), low ? pill(t.left(left), NAVY, CREAM, small) : null].filter(Boolean)),
      h({ fontSize: big, lineHeight: 1.15 }, cut(trip.title, 40)),
      h({ fontSize: mid, opacity: 0.8 }, [cut(trip.location, 20), fmtDates(trip.start_date, trip.end_date)].filter(Boolean).join(' | ')),
      h({ fontSize: mid, color: CORAL }, trip.price > 0 ? won(trip.price, lang) : t.free)) };
  }

  if (type === 'review') {
    const id = q.get('id') || '';
    const r = UUID.test(id) && await store.select(`reviews?select=rating,body,author_name,trip_id&id=eq.${id}&approved=eq.true&limit=1`);
    const rv = r && r.ok && r.data && r.data[0];
    if (!rv) return { status: 404 };
    const trip = rv.trip_id ? await loadTrip(store, rv.trip_id, lang) : null;
    const who = Array.from(String(rv.author_name || ''))[0] || '';
    return { size, lang, pub: true, el: frame(size, lang,
      h({ fontSize: mid, color: CORAL }, `${rv.rating} / 5`),
      h({ fontSize: story ? 64 : 44, lineHeight: 1.3 }, '"' + cut(rv.body, story ? 160 : 110) + '"'),
      h({ fontSize: small, opacity: 0.8 }, [trip && cut(trip.title, 30), who && who + '**'].filter(Boolean).join(' | '))) };
  }

  if (type === 'me-title' || type === 'me-report') {
    const user = await verifyUser(e, req.headers.authorization);
    if (!user) return { status: 401 };
    const p = (await store.select(`profiles?select=xp,mbti,interests,travel_styles&id=eq.${user.id}&limit=1`)).data;
    const me = p && p[0];
    if (!me) return { status: 404 };
    const opts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ai-options.json'), 'utf8'));
    const nm = (group, k) => { const o = (opts[group] || {})[k]; return o ? o[lang] || o.en : k; };
    const level = Math.floor((1 + Math.sqrt(1 + (8 * (me.xp || 0)) / 100)) / 2);
    if (type === 'me-title') {
      const titles = ((await store.select(`user_titles?select=interest&user_id=eq.${user.id}`)).data || []).map((x) => x.interest);
      return { size, lang, pub: false, el: frame(size, lang,
        h({ fontSize: story ? 150 : 100, color: CORAL }, t.level(level)),
        h({ fontSize: mid }, t.titles),
        titles.length ? row({ flexWrap: 'wrap', gap: 14 }, ...titles.slice(0, 6).map((k) => pill(t.title(nm('interests', k)), NAVY, CREAM, mid))) : h({ fontSize: small, opacity: 0.7 }, t.none)) };
    }
    const chips = (list, group) => (list || []).slice(0, 5).map((k) => pill(nm(group, k), NAVY, CREAM, small));
    const sections = [];
    if (me.mbti) sections.push(h({ gap: 10 }, h({ fontSize: small, opacity: 0.7 }, t.mbti), h({ fontSize: big, color: CORAL }, me.mbti)));
    if ((me.travel_styles || []).length) sections.push(h({ gap: 10 }, h({ fontSize: small, opacity: 0.7 }, t.styles), row({ flexWrap: 'wrap', gap: 12 }, ...chips(me.travel_styles, 'travel_styles'))));
    if ((me.interests || []).length) sections.push(h({ gap: 10 }, h({ fontSize: small, opacity: 0.7 }, t.interests), row({ flexWrap: 'wrap', gap: 12 }, ...chips(me.interests, 'interests'))));
    return { size, lang, pub: false, el: frame(size, lang, row({ alignItems: 'center', gap: 20 }, h({ fontSize: big }, t.report), pill(t.level(level), CORAL, '#fff', small)), ...sections) };
  }
  return { status: 400 };
}

async function handler(req, res) {
  if (new URL(req.url, 'http://x').searchParams.get('type') === 'page') return tripPage(req, res);
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.statusCode = 405; return res.end(); }
  const e = env();
  if (!(e.supabaseUrl && e.serviceKey && e.anonKey)) return json(res, 503, { error: 'not_configured' });
  const out = await build(req, e, db(e));
  if (out.status) return json(res, out.status, { error: 'unavailable' });
  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');
  const [width, height] = SIZES[out.size];
  const svg = await satori(out.el, { width, height, fonts: [{ name: 'Jua', data: font(), style: 'normal', weight: 400 }] });
  const png = new Resvg(svg).render().asPng();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', out.pub ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store');
  res.end(png);
}

module.exports = withErrors('og', handler);
