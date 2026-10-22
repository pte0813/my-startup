// POST /api/ai-match  { trip_id, lang }   (Authorization: Bearer <로그인 회원의 access token>)
// 같은 여행을 신청한 사람들 중 나와 성향이 맞는 사람을 골라 이유와 함께 돌려준다.
// - 점수와 공통점은 서버가 직접 계산하고(AI 키가 없어도 동작), Claude는 이유 문장만 다듬는다.
// - 다른 회원의 이름·연락처는 돌려주지 않는다. 동의(ai_consent)한 회원의 선택지 값만 쓰며, 개인 식별 정보는 AI에도 보내지 않는다.
const { env, json, readBody, db, verifyUser, withErrors } = require('./_lib');
const { opts, LANGS, aiEnv, pickLang, cleanProfile, hasAnyTrait, usedToday, recordUse, throttle, askClaude } = require('./_ai');

const FEATURE = 'match';
const MAX_MATCHES = 3;
const MAX_CALLS_PER_DAY = 30; // 반복 조회로 다른 사람의 성향을 추측하는 것을 막는 하루 호출 한도
const FIELDS = 'id,mbti,interests,travel_styles,active_times';

const overlap = (a, b) => a.filter((x) => b.includes(x));
const sameLetters = (a, b) => (a && b ? [...a].filter((c, i) => c === b[i]).length : 0);

function score(me, other) {
  const shared = {
    interests: overlap(me.interests, other.interests),
    travel_styles: overlap(me.travel_styles, other.travel_styles),
    active_times: overlap(me.active_times, other.active_times),
    mbti_letters: sameLetters(me.mbti, other.mbti)
  };
  const mbtiPts = shared.mbti_letters >= 3 ? 2 : shared.mbti_letters === 2 ? 1 : 0;
  const raw = shared.interests.length * 2 + shared.travel_styles.length * 2 + shared.active_times.length * 1.5 + mbtiPts;
  const max = me.interests.length * 2 + me.travel_styles.length * 2 + me.active_times.length * 1.5 + (me.mbti ? 2 : 0);
  // 일치율은 5% 단위로 뭉뚱그려 보여 준다(정확한 값으로 상대 프로필을 역추적하기 어렵게)
  return { shared, pct: max ? Math.min(95, Math.max(5, Math.round((raw / max) * 20) * 5)) : 0, raw };
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!(e.supabaseUrl && e.anonKey && e.serviceKey)) return json(res, 503, { error: 'ai_not_configured' });

  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const body = await readBody(req);
  const tripId = String(body.trip_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return json(res, 400, { error: 'invalid_input' });
  const lang = pickLang(body.lang);

  const store = db(e);
  const mineRes = await store.select(`profiles?select=${FIELDS},ai_consent&id=eq.${user.id}&limit=1`);
  const mineRow = mineRes.ok && mineRes.data && mineRes.data[0];
  if (!mineRow || !mineRow.ai_consent) return json(res, 403, { error: 'consent_required' });
  const me = cleanProfile(mineRow);
  if (!hasAnyTrait(me)) return json(res, 403, { error: 'profile_empty' });

  if (!(await throttle(store, user.id, 'match_call', MAX_CALLS_PER_DAY))) return json(res, 429, { error: 'too_many_requests' });

  const trip = await store.select(`trips?select=id,title,status&id=eq.${tripId}&limit=1`);
  const t = trip.ok && trip.data && trip.data[0];
  if (!t || t.status !== 'open') return json(res, 404, { error: 'trip_not_open' });

  const apps = await store.select(`trip_applications?select=user_id&trip_id=eq.${tripId}&status=neq.cancelled&user_id=neq.${user.id}&limit=200`);
  const ids = (apps.ok && apps.data ? apps.data : []).map((a) => a.user_id).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const total = ids.length;
  let ranked = [];
  if (ids.length) {
    const profs = await store.select(`profiles?select=${FIELDS}&ai_consent=eq.true&id=in.(${ids.join(',')})&limit=200`);
    ranked = (profs.ok && profs.data ? profs.data : [])
      .map((p) => ({ p: cleanProfile(p), ...score(me, cleanProfile(p)) }))
      .filter((c) => c.raw > 0)
      .sort((a, b) => b.raw - a.raw)
      .slice(0, MAX_MATCHES);
  }
  const matches = ranked.map((c, i) => ({
    id: String.fromCharCode(65 + i),
    score: c.pct,
    shared: { interests: c.shared.interests, travel_styles: c.shared.travel_styles, active_times: c.shared.active_times, mbti: c.shared.mbti_letters >= 2 },
    reason: null
  }));

  const cfg = aiEnv();
  let ai = false, limited = false;
  if (matches.length && cfg.key) {
    if ((await usedToday(store, user.id, FEATURE)) >= cfg.dailyLimit) {
      limited = true;
    } else {
      const label = (group, k) => opts[group][k].en;
      const input = matches.map((m) => ({
        id: m.id,
        shared_interests: m.shared.interests.map((k) => label('interests', k)),
        shared_travel_styles: m.shared.travel_styles.map((k) => label('travel_styles', k)),
        shared_active_times: m.shared.active_times.map((k) => label('active_times', k)),
        similar_mbti: m.shared.mbti
      }));
      const out = await askClaude(cfg, {
        system: '너는 소셜링 여행 서비스 함께닿의 매칭 도우미야. 같은 여행에 신청한 참가자 후보마다, 나와 왜 대화가 잘 통할지 한 문장(60자 이내)으로 설명해. ' +
          '주어진 공통점 목록에 있는 내용만 근거로 쓰고, 없는 사실(직업, 나이, 성격 등)을 지어내지 마. 이름이나 개인 정보는 언급하지 마. ' +
          '친근하지만 정중한 말투로, 지정된 언어로만 답해. similar_mbti가 true면 "성향이 비슷하다"고만 말하고 MBTI 유형 자체는 언급하지 마.',
        user: `언어: ${LANGS[lang]}\n여행: ${String(t.title).slice(0, 80)}\n후보:\n${JSON.stringify(input)}`,
        tool: {
          name: 'write_reasons',
          description: '후보별 추천 이유를 기록한다.',
          input_schema: {
            type: 'object',
            properties: { reasons: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } } },
            required: ['reasons']
          }
        }
      });
      if (out && Array.isArray(out.reasons)) {
        for (const r of out.reasons) {
          const m = matches.find((x) => x.id === r.id);
          if (m && typeof r.reason === 'string' && r.reason.trim()) m.reason = r.reason.trim().slice(0, 160);
        }
        ai = matches.some((m) => m.reason);
        await recordUse(store, user.id, FEATURE);
      }
    }
  }
  return json(res, 200, { matches, total_applicants: total, ai, limited });
}

module.exports = withErrors('ai-match', handler);
