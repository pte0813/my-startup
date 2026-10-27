// GET /api/trips → 지금 모집 중인(없으면 곧 열리는) 여행 최대 3개. 랜딩 페이지의 여행 카드용.
// 공개 키(SUPABASE_ANON_KEY)로 공개된 여행과 인원 집계(trip_counts)만 읽는다(숨김·미승인 여행은 RLS가 막는다). 이름·연락처 등 개인정보는 다루지 않는다.
const MAIN = process.env.MAIN_SITE_URL || 'https://hamkkedat-homepage.vercel.app'; // 상세·신청은 메인 사이트에서 한다

const send = (res, status, body, cache) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
};

// 사진이 없으면 장소·제목으로 어울리는 일러스트를 고른다(메인 사이트 app.js와 같은 규칙)
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'method_not_allowed' }); }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return send(res, 200, { kind: 'none', trips: [], main: MAIN });
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const get = async (path) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers }); return r.ok ? r.json() : []; };
  try {
    const rows = await get('trips?select=id,title,location,start_date,end_date,price,capacity,status,photos,art_key,cover_url,is_sample&status=in.(open,upcoming)&order=sort_order.asc,start_date.asc&limit=12');
    let list = rows.filter((t) => t.status === 'open'), kind = 'open';
    if (!list.length) { list = rows.filter((t) => t.status === 'upcoming'); kind = 'soon'; }
    list = list.slice(0, 3);
    const counts = {};
    if (list.length) (await get('trip_counts?select=trip_id,n')).forEach((c) => { counts[c.trip_id] = c.n; });
    const ours = (u) => typeof u === 'string' && u.startsWith(`${SUPABASE_URL}/storage/v1/object/public/trip-photos/`);
    const trips = list.map((t) => {
      const left = t.capacity ? t.capacity - (counts[t.id] || 0) : null;
      const photo = (t.photos || []).find(ours);
      return { id: t.id, title: t.title, location: t.location, price: t.price, start: t.start_date, end: t.end_date, status: t.status, sample: !!t.is_sample, left: left != null && left > 0 && left <= 2 && t.status === 'open' ? left : null, image: photo || (/^[a-z0-9-]{2,30}$/.test(t.art_key || '') ? `${MAIN}/art/dest/${t.art_key}-1.svg` : `${MAIN}/art/cover-${coverKind(t)}.svg`), url: `${MAIN}/trip/${t.id}` };
    });
    return send(res, 200, { kind, trips, main: MAIN }, 'public, s-maxage=120, stale-while-revalidate=600');
  } catch {
    return send(res, 200, { kind: 'none', trips: [], main: MAIN });
  }
};
