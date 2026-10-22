// POST /api/ai-icebreaker  { trip_id, lang }   (Authorization: Bearer <로그인 회원의 access token>)
// 같은 여행을 신청한 사람들의 "공통 관심사 통계"만으로 대화 주제·밸런스 게임·자기소개 템플릿을 만든다.
// - 신청자만 볼 수 있다. 개인별 정보·이름·연락처는 AI에도 응답에도 넣지 않고, 2명 이상 겹치는 항목의 인원 수만 쓴다.
// - 여행·언어별로 한 번 만든 결과를 저장해 모든 참가자가 같은 내용을 본다(참가자 구성이 바뀌면 다시 만든다).
const crypto = require('crypto');
const { env, json, readBody, db, verifyUser, withErrors } = require('./_lib');
const { opts, LANGS, aiEnv, pickLang, cleanProfile, usedToday, recordUse, throttle, askClaude } = require('./_ai');

const FEATURE = 'icebreaker';
const MIN_PEOPLE = 3; // 동의한 참가자가 이보다 적으면 공통점 통계를 내지 않는다(소수일 때 특정인의 성향이 드러나지 않게)
const MAX_CALLS_PER_DAY = 20;
const UUID = /^[0-9a-f-]{36}$/i;

const countBy = (profiles, key) => {
  const n = {};
  for (const p of profiles) for (const k of p[key]) n[k] = (n[k] || 0) + 1;
  return Object.entries(n).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ k, n: c }));
};

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function cleanContent(c) {
  if (!c || typeof c !== 'object') return null;
  const topics = (Array.isArray(c.topics) ? c.topics : []).map((t) => clip(t, 120)).filter(Boolean).slice(0, 5);
  const games = (Array.isArray(c.balance_games) ? c.balance_games : [])
    .map((g) => ({ a: clip(g && g.a, 60), b: clip(g && g.b, 60) })).filter((g) => g.a && g.b).slice(0, 3);
  const intro = clip(c.intro_template, 400), opener = clip(c.opener, 300);
  return topics.length && games.length && intro ? { topics, balance_games: games, intro_template: intro, opener } : null;
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!(e.supabaseUrl && e.anonKey && e.serviceKey)) return json(res, 503, { error: 'ai_not_configured' });

  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const body = await readBody(req);
  const tripId = String(body.trip_id || '');
  if (!UUID.test(tripId)) return json(res, 400, { error: 'invalid_input' });
  const lang = pickLang(body.lang);

  const store = db(e);
  const mine = await store.select(`trip_applications?select=id&trip_id=eq.${tripId}&user_id=eq.${user.id}&status=neq.cancelled&limit=1`);
  if (!(mine.ok && mine.data && mine.data[0])) return json(res, 403, { error: 'not_applicant' });

  const trip = await store.select(`trips?select=id,title,status&id=eq.${tripId}&limit=1`);
  const t = trip.ok && trip.data && trip.data[0];
  if (!t || t.status !== 'open') return json(res, 404, { error: 'trip_not_open' });

  if (!(await throttle(store, user.id, 'ice_call', MAX_CALLS_PER_DAY))) return json(res, 429, { error: 'too_many_requests' });

  const apps = await store.select(`trip_applications?select=user_id&trip_id=eq.${tripId}&status=neq.cancelled&limit=200`);
  const ids = (apps.ok && apps.data ? apps.data : []).map((a) => a.user_id).filter((x) => UUID.test(x));
  const profs = ids.length ? await store.select(`profiles?select=id,interests,travel_styles,active_times&ai_consent=eq.true&id=in.(${ids.join(',')})&limit=200`) : { ok: true, data: [] };
  const people = (profs.ok && profs.data ? profs.data : []).map(cleanProfile);
  const enough = people.length >= MIN_PEOPLE;
  const stats = {
    participants: ids.length,
    consenting: people.length,
    interests: enough ? countBy(people, 'interests') : [],
    travel_styles: enough ? countBy(people, 'travel_styles') : [],
    active_times: enough ? countBy(people, 'active_times') : []
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify([stats, lang])).digest('hex').slice(0, 16);

  const cachedRes = await store.select(`ai_icebreakers?select=stats_hash,content&trip_id=eq.${tripId}&lang=eq.${lang}&limit=1`);
  const cached = cachedRes.ok && cachedRes.data && cachedRes.data[0];
  if (cached && cached.stats_hash === hash) return json(res, 200, { content: cached.content, stats, ai: true, cached: true, limited: false });

  const cfg = aiEnv();
  const fallback = (limited) => json(res, 200, { content: cached ? cached.content : null, stats, ai: !!cached, cached: !!cached, limited });
  if (!cfg.key) return fallback(false);
  if ((await usedToday(store, user.id, FEATURE)) >= cfg.dailyLimit) return fallback(true);

  const name = (group, k) => opts[group][k].en;
  const input = {
    participants: stats.participants,
    members_with_profile: stats.consenting,
    shared_interests: stats.interests.map((x) => ({ name: name('interests', x.k), people: x.n })),
    shared_travel_styles: stats.travel_styles.map((x) => ({ name: name('travel_styles', x.k), people: x.n })),
    shared_active_times: stats.active_times.map((x) => ({ name: name('active_times', x.k), people: x.n }))
  };
  const out = await askClaude(cfg, {
    system: '너는 소셜링 여행 서비스 함께닿의 아이스브레이킹 도우미야. 처음 만나는 20~30대 여행 참가자들이 어색함 없이 대화를 시작하도록 돕는 글을 만들어. ' +
      '주어진 통계(여럿이 공통으로 가진 관심사·여행 스타일·활동 시간대)를 활용하되, 통계에 없는 사실(직업, 나이, 성격, 개인 사정)은 지어내지 마. ' +
      '공통 항목이 없으면 여행지와 여행 자체에 대한 가벼운 주제를 써. 정치·종교·연봉·외모·나이·연애 같은 민감한 주제는 피하고, 누구나 편하게 답할 수 있는 질문으로 만들어. ' +
      '말투는 친근하지만 정중하게, 지정된 언어로만 써. 대화 주제 4개, 밸런스 게임 3개(a와 b 두 선택지), 빈칸을 채우는 자기소개 템플릿, 단톡방 첫인사 한 문단을 작성해.',
    user: `언어: ${LANGS[lang]}\n여행: ${String(t.title).slice(0, 80)}\n통계:\n${JSON.stringify(input)}`,
    tool: {
      name: 'write_icebreakers',
      description: '아이스브레이킹 자료를 기록한다.',
      input_schema: {
        type: 'object',
        properties: {
          topics: { type: 'array', items: { type: 'string' } },
          balance_games: { type: 'array', items: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a', 'b'] } },
          intro_template: { type: 'string' },
          opener: { type: 'string' }
        },
        required: ['topics', 'balance_games', 'intro_template', 'opener']
      }
    }
  });
  const content = cleanContent(out);
  if (!content) return fallback(false);
  await recordUse(store, user.id, FEATURE);
  await store.upsert('ai_icebreakers', { trip_id: tripId, lang, stats_hash: hash, content, created_at: new Date().toISOString() }, 'trip_id,lang');
  return json(res, 200, { content, stats, ai: true, cached: false, limited: false });
}

module.exports = withErrors('ai-icebreaker', handler);
