// POST /api/reunion  { action: 'list' | 'pick' | 'unpick' | 'suggest' | 'report', trip_id, application_id?, lang?, reason?, detail? }
// 지난 여행에서 "다시 만나고 싶은 사람"을 고르고, 서로 골랐을 때만 성사로 알려 준다.
// - 내가 누구를 골랐는지는 상대에게 절대 보이지 않는다(상대가 나를 골랐는지는 내가 그 사람을 골랐을 때만 "성사"로 알 수 있다).
// - 같은 여행의 참가자(신청 취소 제외)만 서로 보이고, 이름은 프로필 이름만 쓴다. 연락처는 어디에도 나오지 않는다.
// - 모든 읽기·쓰기는 이 서버 함수(service_role)로만 한다. reunion_picks 표는 브라우저에서 접근할 수 없다.
const { env, json, readBody, db, verifyUser, withErrors } = require('./_lib');
const { aiEnv, pickLang, LANGS, cleanProfile, usedToday, recordUse, askClaude, opts } = require('./_ai');

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_PICKS = 5;
const FEATURE = 'reunion';

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!(e.supabaseUrl && e.anonKey && e.serviceKey)) return json(res, 503, { error: 'not_configured' });
  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const body = await readBody(req);
  const action = String(body.action || '');
  const tripId = String(body.trip_id || '');
  const appId = body.application_id == null ? '' : String(body.application_id);
  if (!['list', 'pick', 'unpick', 'suggest', 'report'].includes(action) || !UUID.test(tripId) || (action !== 'list' && !UUID.test(appId))) return json(res, 400, { error: 'invalid_input' });
  const lang = pickLang(body.lang);
  const store = db(e);

  const trip = await store.select(`trips?select=id,title,status&id=eq.${tripId}&limit=1`);
  const t = trip.ok && trip.data && trip.data[0];
  if (!t || t.status !== 'past') return json(res, 404, { error: 'trip_not_past' });

  const apps = await store.select(`trip_applications?select=id,user_id,name&trip_id=eq.${tripId}&status=neq.cancelled&limit=200`);
  const all = (apps.ok && apps.data ? apps.data : []).filter((a) => UUID.test(a.user_id));
  if (!all.some((a) => a.user_id === user.id)) return json(res, 403, { error: 'not_attendee' });
  const others = all.filter((a) => a.user_id !== user.id);

  const picksOf = async (col, val) => {
    const r = await store.select(`reunion_picks?select=from_user,to_user&trip_id=eq.${tripId}&${col}=eq.${val}&limit=200`);
    return r.ok && r.data ? r.data : [];
  };

  if (action === 'report') {
    // 같은 지난 여행의 참가자를 신고한다. 상대의 계정 정보는 브라우저로 내려보내지 않고 서버가 대상 회원을 찾아 신고를 접수한다.
    const target = others.find((a) => a.id === appId);
    const reason = ['spam', 'abuse', 'inappropriate', 'noshow', 'other'].includes(body.reason) ? body.reason : null;
    if (!target || !reason) return json(res, 400, { error: 'invalid_input' });
    const mine = await store.select(`profiles?select=status&id=eq.${user.id}&limit=1`);
    if (mine.ok && mine.data && mine.data[0] && mine.data[0].status === 'suspended') return json(res, 403, { error: 'suspended' });
    const ins = await store.insert('reports', { reporter_id: user.id, target_type: 'user', target_id: target.user_id, reason, detail: String(body.detail || '').trim().slice(0, 1000) });
    if (!ins.ok) return json(res, ins.status === 409 ? 409 : 502, { error: ins.status === 409 ? 'already_reported' : 'save_failed' });
    return json(res, 200, { ok: true });
  }

  if (action === 'pick') {
    const target = others.find((a) => a.id === appId);
    if (!target) return json(res, 404, { error: 'no_such_attendee' });
    const mine = await picksOf('from_user', user.id);
    if (!mine.some((p) => p.to_user === target.user_id)) {
      if (mine.length >= MAX_PICKS) return json(res, 409, { error: 'too_many_picks', max: MAX_PICKS });
      const ins = await store.insertIgnore('reunion_picks', { trip_id: tripId, from_user: user.id, to_user: target.user_id }, 'trip_id,from_user,to_user');
      if (!ins.ok) return json(res, 502, { error: 'save_failed' });
    }
  } else if (action === 'unpick') {
    const target = others.find((a) => a.id === appId);
    if (!target) return json(res, 404, { error: 'no_such_attendee' });
    // 상대도 나를 골랐다면(성사) 취소할 수 없다. 취소가 가능하면 "선택해 보고 상대 마음만 확인한 뒤 취소"하는 엿보기가 되기 때문이다.
    const theirs = await picksOf('from_user', target.user_id);
    if (theirs.some((p) => p.to_user === user.id)) return json(res, 409, { error: 'already_matched' });
    const del = await store.remove(`reunion_picks?trip_id=eq.${tripId}&from_user=eq.${user.id}&to_user=eq.${target.user_id}`);
    if (!del.ok) return json(res, 502, { error: 'save_failed' });
  }

  // 내가 고른 사람, 그리고 그중 나를 함께 고른 사람(성사)
  const myPicks = await picksOf('from_user', user.id);
  const pickedMe = await picksOf('to_user', user.id);
  const pickedSet = new Set(myPicks.map((p) => p.to_user));
  const matchedSet = new Set(pickedMe.map((p) => p.from_user).filter((u) => pickedSet.has(u)));

  if (action === 'suggest') {
    const target = others.find((a) => a.id === appId);
    if (!target || !matchedSet.has(target.user_id)) return json(res, 403, { error: 'not_matched' });
    const open = await store.select('trips?select=id,title,location&status=eq.open&order=sort_order.asc&limit=8');
    const trips = open.ok && open.data ? open.data : [];
    let text = null, chosen = trips.slice(0, 3);
    const cfg = aiEnv();
    if (cfg.key && trips.length && (await usedToday(store, user.id, FEATURE)) < cfg.dailyLimit) {
      const profs = await store.select(`profiles?select=id,interests,travel_styles,active_times&ai_consent=eq.true&id=in.(${user.id},${target.user_id})`);
      const rows = (profs.ok && profs.data ? profs.data : []).map((p) => ({ id: p.id, ...cleanProfile(p) }));
      const meP = rows.find((r) => r.id === user.id), otP = rows.find((r) => r.id === target.user_id);
      const shared = (k) => (meP && otP ? meP[k].filter((x) => otP[k].includes(x)) : []);
      const label = (g, k) => opts[g][k].en;
      const out = await askClaude(cfg, {
        system: '너는 소셜링 여행 서비스 함께닿의 재만남 도우미야. 지난 여행에서 서로 다시 만나고 싶다고 고른 두 사람에게 다음 모임을 제안해. ' +
          '주어진 공통점과 모집 중인 여행 목록만 근거로 하고 없는 사실을 지어내지 마. 이름은 쓰지 마. 여행 목록에서 어울리는 1~2개를 고르고(trip_ids), ' +
          '왜 어울리는지 1~2문장(120자 이내)으로 친근하고 정중하게 지정된 언어로 써.',
        user: `언어: ${LANGS[lang]}\n함께했던 여행: ${String(t.title).slice(0, 80)}\n공통 관심사: ${JSON.stringify(shared('interests').map((k) => label('interests', k)))}\n공통 여행 스타일: ${JSON.stringify(shared('travel_styles').map((k) => label('travel_styles', k)))}\n모집 중인 여행:\n${JSON.stringify(trips.map((x) => ({ id: x.id, title: String(x.title).slice(0, 60), location: x.location })))}`,
        tool: {
          name: 'write_suggestion',
          description: '다음 모임 제안을 기록한다.',
          input_schema: { type: 'object', properties: { text: { type: 'string' }, trip_ids: { type: 'array', items: { type: 'string' } } }, required: ['text', 'trip_ids'] }
        }
      });
      if (out && typeof out.text === 'string' && out.text.trim()) {
        text = out.text.trim().slice(0, 300);
        const picked = (Array.isArray(out.trip_ids) ? out.trip_ids : []).map((id) => trips.find((x) => x.id === id)).filter(Boolean).slice(0, 2);
        if (picked.length) chosen = picked;
        await recordUse(store, user.id, FEATURE);
      }
    }
    return json(res, 200, { text, trips: chosen.map((x) => ({ id: x.id, title: x.title, location: x.location })), ai: !!text });
  }

  const nameRes = others.length ? await store.select(`profiles?select=id,name&id=in.(${others.map((a) => a.user_id).join(',')})`) : { ok: true, data: [] };
  const names = new Map((nameRes.ok && nameRes.data ? nameRes.data : []).map((p) => [p.id, p.name]));
  const candidates = others.map((a) => ({
    application_id: a.id,
    name: String(names.get(a.user_id) || a.name || '').slice(0, 100),
    picked: pickedSet.has(a.user_id),
    matched: matchedSet.has(a.user_id)
  }));
  return json(res, 200, { candidates, max_picks: MAX_PICKS, picks_left: Math.max(0, MAX_PICKS - myPicks.length) });
}

module.exports = withErrors('reunion', handler);
